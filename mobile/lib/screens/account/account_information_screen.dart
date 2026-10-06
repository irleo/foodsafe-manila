import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'package:foodsafe_manila/services/api_client.dart';
import 'package:foodsafe_manila/services/api_service.dart';
import 'package:foodsafe_manila/services/session.dart';
import 'package:foodsafe_manila/services/phone_change_flow.dart';
import 'package:foodsafe_manila/utils/philippine_mobile_number.dart';
import 'package:foodsafe_manila/widgets/app_loading.dart';
import 'package:foodsafe_manila/widgets/philippine_mobile_prefix.dart';
import 'package:foodsafe_manila/widgets/snackbar_widgets.dart';
import 'package:foodsafe_manila/screens/legal/policy_screen.dart';
import 'package:foodsafe_manila/utils/recovery_email.dart';

class AccountInformationScreen extends StatefulWidget {
  const AccountInformationScreen({super.key});

  @override
  State<AccountInformationScreen> createState() =>
      _AccountInformationScreenState();
}

class _AccountInformationScreenState extends State<AccountInformationScreen> {
  final _formKey = GlobalKey<FormState>();

  final user = Session.currentUser;

  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _currentPasswordCtrl = TextEditingController();
  bool _showCurrentPassword = false;

  bool _loading = false;
  bool _updated = false;
  bool _isEditing = false;

  bool get _contactChanged =>
      _phoneCtrl.text.replaceAll(RegExp(r'\D'), '') !=
          (_originalPhoneNumber ?? '').replaceAll(RegExp(r'\D'), '') ||
      normalizeRecoveryEmail(_emailCtrl.text) !=
          normalizeRecoveryEmail(Session.currentUser?['email'] as String?);

  // OTP verification related
  bool _isOtpVerificationMode = false;
  String? _pendingPhoneNumber;
  String? _originalPhoneNumber;
  final _otpCtrl = TextEditingController();
  late List<TextEditingController> otpControllers;
  late List<FocusNode> otpFocusNodes;
  Timer? _resendTimer;
  int _resendSeconds = 0;
  PhoneChangeFlow? _phoneFlow;
  DateTime? _resendAt;
  DateTime? _expiresAt;
  bool _flowExpired = false;
  String? _otpError;
  int _flowGeneration = 0;

  @override
  void initState() {
    super.initState();

    // Initialize OTP controllers
    otpControllers = List.generate(6, (_) => TextEditingController());
    otpFocusNodes = List.generate(6, (_) => FocusNode());

    if (user != null) {
      _nameCtrl.text = user!['username'] ?? '';
      final originalPhone = user!['phoneNumber']?.toString() ?? '';
      _originalPhoneNumber = toPhilippineMobileInput(originalPhone);
      _phoneCtrl.text = toPhilippineMobileInput(
        user!['phoneNumber']?.toString() ?? '',
      );
      _emailCtrl.text = user!['email'] ?? '';
    }
  }

  @override
  void dispose() {
    _resendTimer?.cancel();
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _currentPasswordCtrl.dispose();
    _otpCtrl.dispose();
    for (var c in otpControllers) {
      c.dispose();
    }
    for (var f in otpFocusNodes) {
      f.dispose();
    }
    super.dispose();
  }

  void _handleOtpKey(int index, KeyEvent event) {
    if (event is! KeyDownEvent) return;

    if (event.logicalKey == LogicalKeyboardKey.backspace) {
      if (otpControllers[index].text.isEmpty && index > 0) {
        otpControllers[index - 1].clear();

        FocusScope.of(context).requestFocus(otpFocusNodes[index - 1]);
      }

      // Always keep the combined OTP updated.
      _updateOtp();
    }
  }

  void _updateOtp() {
    _otpCtrl.text = otpControllers.map((c) => c.text).join();
  }

  void _startResendTimer(int seconds) {
    _resendTimer?.cancel();
    _resendAt = DateTime.now().add(Duration(seconds: seconds));
    setState(() => _resendSeconds = seconds);
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      final now = DateTime.now();
      final remaining = (_resendAt!.difference(now).inMilliseconds / 1000)
          .ceil();
      setState(() {
        _resendSeconds = remaining > 0 ? remaining : 0;
        if (_expiresAt != null && !now.isBefore(_expiresAt!)) {
          _flowExpired = true;
          _otpError = 'This code has expired. Start verification again.';
        }
      });
      if (_resendSeconds == 0 && (_expiresAt == null || _flowExpired)) {
        timer.cancel();
      }
    });
  }

  void _clearOtpFields() {
    for (final controller in otpControllers) {
      controller.clear();
    }
    _otpCtrl.clear();
  }

  void _cancelPhoneChange() {
    if (_loading) return;
    _flowGeneration++;
    _resendTimer?.cancel();
    _clearOtpFields();
    _currentPasswordCtrl.clear();
    setState(() {
      _isOtpVerificationMode = false;
      _pendingPhoneNumber = null;
      _resendSeconds = 0;
      _phoneFlow = null;
      _expiresAt = null;
      _otpError = null;
      _flowExpired = false;
      _phoneCtrl.text = _originalPhoneNumber ?? '';
    });
  }

  Future<void> _sendPhoneChangeOtp({
    bool resend = false,
    bool beginVerification = false,
  }) async {
    final phone = _pendingPhoneNumber;
    if (phone == null || _loading || _resendSeconds > 0) return;
    final version = ++_flowGeneration;

    setState(() => _loading = true);
    try {
      if (!await ensureAccountPolicies(context) || !mounted) return;
      final flow = await ApiService.sendPhoneChangeOtp(
        phone: phone,
        flowId: resend && !_flowExpired ? _phoneFlow?.id : null,
      );
      if (!mounted || version != _flowGeneration) return;
      _phoneFlow = flow;
      _expiresAt = DateTime.now().add(Duration(seconds: flow.expiresInSeconds));
      _flowExpired = false;
      _otpError = null;

      if (beginVerification) {
        setState(() => _isOtpVerificationMode = true);
      }
      if (resend) _clearOtpFields();
      _startResendTimer(flow.retryAfterSeconds);
      SnackbarWidgets.info(
        context,
        "We've sent a verification code to your phone number",
      );
      FocusScope.of(context).requestFocus(otpFocusNodes[0]);
    } catch (error) {
      if (mounted) {
        if (error is ApiException && error.retryAfterSeconds != null) {
          _startResendTimer(error.retryAfterSeconds!);
        }
        if (error is ApiException && error.code == 'OTP_FLOW_EXPIRED') {
          _flowExpired = true;
        }
        if (!beginVerification) {
          _otpError = ApiClient.safeErrorMessage(
            error,
            fallback:
                "We couldn't send the phone-change code. Please try again.",
          );
        }
        if (beginVerification) {
          setState(() => _pendingPhoneNumber = null);
        }
        if (error is ApiException && error.statusCode == 409) {
          SnackbarWidgets.info(
            context,
            ApiClient.safeErrorMessage(
              error,
              fallback:
                  'This phone change could not start. Check the number or restart verification.',
            ),
          );
        } else {
          SnackbarWidgets.error(
            context,
            ApiClient.safeErrorMessage(
              error,
              fallback:
                  "We couldn't send the phone-change code. Please try again.",
            ),
          );
        }
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _verifyPhoneChangeOtp() async {
    final phone = _pendingPhoneNumber;
    if (phone == null || _loading || _phoneFlow == null || _flowExpired) return;
    if (_otpCtrl.text.length != 6) {
      setState(() => _otpError = 'Enter the 6-digit verification code');
      return;
    }

    final userId = (user?['_id'] ?? user?['id'])?.toString();
    if (userId == null || userId.isEmpty) {
      SnackbarWidgets.error(context, "Unable to identify your account");
      return;
    }

    setState(() => _loading = true);
    try {
      if (!await ensureAccountPolicies(context) || !mounted) return;
      final updatedUser = await ApiService.updateUser(
        id: userId,
        username: _nameCtrl.text.trim(),
        phone: phone,
        email: _emailCtrl.text.trim().isEmpty ? null : _emailCtrl.text.trim(),
        flowId: _phoneFlow!.id,
        otp: _otpCtrl.text,
        currentPassword: _currentPasswordCtrl.text,
      );

      if (!mounted) return;
      if (updatedUser == null) {
        SnackbarWidgets.error(
          context,
          "We couldn't save your phone change. Please reload your account and try again.",
        );
        return;
      }

      _resendTimer?.cancel();
      _clearOtpFields();
      _currentPasswordCtrl.clear();
      final updatedPhone = updatedUser['phoneNumber']?.toString() ?? '';
      setState(() {
        _originalPhoneNumber = toPhilippineMobileInput(updatedPhone);
        _phoneCtrl.text = _originalPhoneNumber!;
        _nameCtrl.text = updatedUser['username'] ?? '';
        _emailCtrl.text = updatedUser['email'] ?? '';
        _isOtpVerificationMode = false;
        _pendingPhoneNumber = null;
        _resendSeconds = 0;
        _phoneFlow = null;
        _expiresAt = null;
        _otpError = null;
        _flowExpired = false;
        _isEditing = false;
        _updated = true;
      });
      SnackbarWidgets.success(context, "Profile updated successfully");
    } catch (error) {
      if (mounted) {
        setState(() {
          _otpError = ApiClient.safeErrorMessage(
            error,
            fallback:
                "We couldn't verify your phone change. Please try again before the code expires.",
          );
          if (error is ApiException &&
              (error.code == 'OTP_FLOW_EXPIRED' ||
                  error.code == 'OTP_ATTEMPTS_EXCEEDED')) {
            _flowExpired = true;
          }
        });
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  // Build OTP verification UI
  Widget _buildOtpVerificationStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          "Verification code",
          style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 10),
        Text(
          'Enter the 6-digit code sent to ${_phoneFlow?.maskedPhone ?? 'your new phone'}.',
          style: GoogleFonts.inter(fontSize: 14),
        ),
        const SizedBox(height: 30),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: List.generate(6, (index) {
            return Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 3),
                child: SizedBox(
                  height: 50,
                  child: KeyboardListener(
                    focusNode: FocusNode(),
                    onKeyEvent: (event) => _handleOtpKey(index, event),
                    child: TextFormField(
                      controller: otpControllers[index],
                      focusNode: otpFocusNodes[index],

                      keyboardType: TextInputType.number,
                      textInputAction: TextInputAction.next,

                      textAlign: TextAlign.center,
                      textAlignVertical: TextAlignVertical.center,

                      style: GoogleFonts.inter(fontWeight: FontWeight.w800),

                      inputFormatters: [
                        LengthLimitingTextInputFormatter(1),
                        FilteringTextInputFormatter.digitsOnly,
                      ],

                      onChanged: (value) {
                        _updateOtp();

                        if (value.isNotEmpty && index < 5) {
                          FocusScope.of(
                            context,
                          ).requestFocus(otpFocusNodes[index + 1]);
                        }
                      },

                      decoration: InputDecoration(
                        contentPadding: EdgeInsets.zero,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(
                            color: Color(0xFFD1D5DB),
                          ),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(
                            color: Color(0xFFD1D5DB),
                          ),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(
                            color: Color(0xFF134c8c),
                            width: 2,
                          ),
                        ),
                        errorMaxLines: 2,
                        errorStyle: GoogleFonts.inter(
                          fontSize: 11,
                          color: const Color(0xFFDC2626),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            );
          }),
        ),
        const SizedBox(height: 10),
        if (_otpError != null)
          Semantics(
            liveRegion: true,
            child: Text(
              _otpError!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ),
        Wrap(
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text('Did not receive code?', style: GoogleFonts.inter()),
            TextButton(
              onPressed: _loading || _resendSeconds > 0
                  ? null
                  : () => _sendPhoneChangeOtp(resend: true),
              style: ButtonStyle(
                visualDensity: VisualDensity(horizontal: -4, vertical: -4),
              ),
              child: Text(
                _resendSeconds > 0
                    ? "Resend in $_resendSeconds s"
                    : _flowExpired
                    ? 'Start again'
                    : "Resend Code",
                style: GoogleFonts.inter(
                  fontWeight: FontWeight.w600,
                  color: _resendSeconds > 0
                      ? Colors.grey
                      : const Color(0xFF134c8c),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),
        Row(
          children: [
            Expanded(
              child: ElevatedButton(
                onPressed: _loading || _flowExpired
                    ? null
                    : _verifyPhoneChangeOtp,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF134c8c),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  elevation: 0,
                ),
                child: _loading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: AppLoadingIndicator(
                          size: 20,
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Text(
                        "Verify",
                        style: GoogleFonts.inter(fontWeight: FontWeight.w800),
                      ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();

    if (!_formKey.currentState!.validate()) return;

    // Check if phone number has changed
    final currentPhone = toLocalPhilippineMobileNumber(_phoneCtrl.text);
    final originalPhone = toLocalPhilippineMobileNumber(
      _originalPhoneNumber ?? '',
    );

    final phoneChanged = currentPhone != originalPhone;

    if (phoneChanged) {
      setState(() => _pendingPhoneNumber = currentPhone);
      await _sendPhoneChangeOtp(beginVerification: true);

      return;
    }

    // If no phone number change, update directly
    setState(() => _loading = true);

    try {
      if (user == null) return;
      if (!await ensureAccountPolicies(context) || !mounted) return;

      final userId = (user!['_id'] ?? user!['id'])?.toString();
      if (userId == null || userId.isEmpty) return;

      final updatedUser = await ApiService.updateUser(
        id: userId,
        username: _nameCtrl.text.trim(),
        phone: toLocalPhilippineMobileNumber(_phoneCtrl.text),
        email: _emailCtrl.text.trim().isEmpty ? null : _emailCtrl.text.trim(),
        currentPassword: _currentPasswordCtrl.text,
      );

      if (!mounted) return;

      if (updatedUser != null) {
        _nameCtrl.text = updatedUser['username'] ?? '';

        final updatedPhone = updatedUser['phoneNumber']?.toString() ?? '';

        _originalPhoneNumber = toPhilippineMobileInput(updatedPhone);
        _phoneCtrl.text = _originalPhoneNumber!;

        _emailCtrl.text = updatedUser['email'] ?? '';
        _currentPasswordCtrl.clear();

        _updated = true;
        _isEditing = false;

        SnackbarWidgets.success(context, "Profile updated successfully");
      } else {
        SnackbarWidgets.error(
          context,
          "We couldn't save your account changes. Please try again.",
        );
      }
    } catch (error) {
      if (mounted) {
        SnackbarWidgets.error(
          context,
          ApiClient.safeErrorMessage(
            error,
            fallback:
                "We couldn't save your account changes. Please try again.",
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB), // bg-gray-50
      body: SafeArea(
        top: true,
        child: PopScope(
          canPop: (_isEditing || _isOtpVerificationMode) ? false : true,
          onPopInvokedWithResult: (didPop, result) async {
            if (_loading) return;
            if (didPop) {
              return;
            }

            // If in OTP verification mode, confirm cancellation
            if (_isOtpVerificationMode) {
              final confirm = await showDialog<bool>(
                context: context,
                barrierDismissible: false,
                builder: (context) => AlertDialog(
                  backgroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  title: Text(
                    "Cancel verification?",
                    style: GoogleFonts.inter(fontWeight: FontWeight.w600),
                  ),
                  content: Text(
                    "Your phone number change will be cancelled. Are you sure?",
                    style: GoogleFonts.inter(),
                  ),
                  actions: [
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () {
                              Navigator.pop(context, true);
                            },
                            style: OutlinedButton.styleFrom(
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                              side: const BorderSide(color: Color(0xFF134c8c)),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            child: Text(
                              "Yes",
                              style: GoogleFonts.inter(
                                fontWeight: FontWeight.w500,
                                color: Color(0xFF134c8c),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: () {
                              Navigator.pop(context, false);
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF134c8c),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            child: Text(
                              "No",
                              style: GoogleFonts.inter(
                                color: Colors.white,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              );

              if (!context.mounted) return;

              if (confirm == true) {
                _cancelPhoneChange();
              }
              return;
            }

            // Original unsaved changes dialog
            final confirm = await showDialog<bool>(
              context: context,
              barrierDismissible: false,
              builder: (context) => AlertDialog(
                backgroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                title: Text(
                  "Unsaved Changes",
                  style: GoogleFonts.inter(fontWeight: FontWeight.w600),
                ),
                content: Text(
                  "You have unsaved changes. Are you sure you want to discard them?",
                  style: GoogleFonts.inter(),
                ),
                actions: [
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () {
                            Navigator.pop(context, true);
                          },
                          style: OutlinedButton.styleFrom(
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                            side: const BorderSide(color: Color(0xFF134c8c)),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                          ),
                          child: Text(
                            "Yes",
                            style: GoogleFonts.inter(
                              fontWeight: FontWeight.w500,
                              color: Color(0xFF134c8c),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: () {
                            Navigator.pop(context, false);
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF134c8c),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                          ),
                          child: Text(
                            "No",
                            style: GoogleFonts.inter(
                              color: Colors.white,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );

            if (!context.mounted) return;

            if (confirm == true) {
              if (!context.mounted) return;
              Navigator.pop(context);
            }
          },

          child: ListView(
            padding: const EdgeInsets.only(bottom: 24),
            children: [
              // Header with gradient
              Container(
                padding: const EdgeInsets.fromLTRB(16, 36, 16, 36),
                decoration: const BoxDecoration(color: Color(0xFF134c8c)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    InkWell(
                      onTap: _loading
                          ? null
                          : _isOtpVerificationMode
                          ? () async {
                              final confirm = await showDialog<bool>(
                                context: context,
                                barrierDismissible: false,
                                builder: (context) => AlertDialog(
                                  backgroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                  title: Text(
                                    "Cancel verification?",
                                    style: GoogleFonts.inter(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  content: Text(
                                    "Your phone number change will be cancelled. Are you sure?",
                                    style: GoogleFonts.inter(),
                                  ),
                                  actions: [
                                    Row(
                                      children: [
                                        Expanded(
                                          child: OutlinedButton(
                                            onPressed: () {
                                              Navigator.pop(context, true);
                                            },
                                            style: OutlinedButton.styleFrom(
                                              shape: RoundedRectangleBorder(
                                                borderRadius:
                                                    BorderRadius.circular(10),
                                              ),
                                              side: const BorderSide(
                                                color: Color(0xFF134c8c),
                                              ),
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                    vertical: 12,
                                                  ),
                                            ),
                                            child: Text(
                                              "Yes",
                                              style: GoogleFonts.inter(
                                                fontWeight: FontWeight.w500,
                                                color: Color(0xFF134c8c),
                                              ),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 10),
                                        Expanded(
                                          child: ElevatedButton(
                                            onPressed: () {
                                              Navigator.pop(context, false);
                                            },
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: Color(
                                                0xFF134c8c,
                                              ),
                                              shape: RoundedRectangleBorder(
                                                borderRadius:
                                                    BorderRadius.circular(10),
                                              ),
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                    vertical: 12,
                                                  ),
                                            ),
                                            child: Text(
                                              "No",
                                              style: GoogleFonts.inter(
                                                color: Colors.white,
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              );

                              if (!context.mounted) return;

                              if (confirm == true) {
                                _cancelPhoneChange();
                              }
                            }
                          : _isEditing
                          ? () async {
                              final confirm = await showDialog(
                                context: context,
                                builder: (context) => AlertDialog(
                                  backgroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                  title: Text(
                                    "Unsaved Changes",
                                    style: GoogleFonts.inter(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  content: Text(
                                    "You have unsaved changes. Are you sure you want to discard them?",
                                    style: GoogleFonts.inter(),
                                  ),
                                  actions: [
                                    Row(
                                      children: [
                                        Expanded(
                                          child: OutlinedButton(
                                            onPressed: () {
                                              Navigator.pop(context, true);
                                            },
                                            style: OutlinedButton.styleFrom(
                                              shape: RoundedRectangleBorder(
                                                borderRadius:
                                                    BorderRadius.circular(10),
                                              ),
                                              side: const BorderSide(
                                                color: Color(0xFF134c8c),
                                              ),
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                    vertical: 12,
                                                  ),
                                            ),
                                            child: Text(
                                              "Yes",
                                              style: GoogleFonts.inter(
                                                fontWeight: FontWeight.w500,
                                                color: Color(0xFF134c8c),
                                              ),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 10),
                                        Expanded(
                                          child: ElevatedButton(
                                            onPressed: () {
                                              Navigator.pop(context, false);
                                            },
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: const Color(
                                                0xFF134c8c,
                                              ),
                                              shape: RoundedRectangleBorder(
                                                borderRadius:
                                                    BorderRadius.circular(10),
                                              ),
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                    vertical: 12,
                                                  ),
                                            ),
                                            child: Text(
                                              "No",
                                              style: GoogleFonts.inter(
                                                color: Colors.white,
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              );

                              if (!context.mounted) return;

                              if (confirm == true) {
                                if (!context.mounted) return;
                                Navigator.pop(context);
                              }
                            }
                          : () => Navigator.pop(context, _updated),
                      child: Row(
                        children: [
                          Icon(
                            LucideIcons.arrowLeft,
                            color: Colors.white,
                            size: 20,
                          ),
                          SizedBox(width: 6),
                          Text(
                            "Back",
                            style: GoogleFonts.inter(
                              color: Colors.white70,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Account Information',
                      style: GoogleFonts.inter(
                        color: Colors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              Transform.translate(
                offset: const Offset(0, -20),
                child: Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(color: Colors.grey.shade200),
                          boxShadow: const [
                            BoxShadow(
                              color: Colors.black12,
                              blurRadius: 6,
                              offset: Offset(0, 3),
                            ),
                          ],
                        ),
                        child: _isOtpVerificationMode
                            ? _buildOtpVerificationStep()
                            : Form(
                                key: _formKey,
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    _InputField(
                                      label: "Name",
                                      child: TextFormField(
                                        controller: _nameCtrl,
                                        enabled: _isEditing,
                                        validator: (v) {
                                          return (v == null ||
                                                  v.isEmpty ||
                                                  v.trim().isEmpty)
                                              ? "Name is required"
                                              : null;
                                        },
                                        style: GoogleFonts.inter(),
                                        decoration: InputDecoration(
                                          prefixIcon: Icon(
                                            LucideIcons.user,
                                            color: Theme.of(
                                              context,
                                            ).colorScheme.outline,
                                          ),
                                          hintText: 'Juan Dela Cruz',
                                          hintStyle: GoogleFonts.inter(
                                            color: Color(0xFFD1D5DB),
                                          ),
                                          contentPadding:
                                              const EdgeInsets.symmetric(
                                                vertical: 14,
                                              ),
                                          border: OutlineInputBorder(
                                            borderRadius: BorderRadius.circular(
                                              12,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 16),
                                    _InputField(
                                      label: "Phone Number",
                                      child: TextFormField(
                                        controller: _phoneCtrl,
                                        onChanged: (_) => setState(() {}),
                                        enabled: _isEditing,
                                        validator:
                                            validatePhilippineMobileInput,
                                        keyboardType: TextInputType.number,
                                        inputFormatters: const [
                                          PhilippineMobileInputFormatter(),
                                        ],
                                        style: GoogleFonts.inter(),
                                        decoration: InputDecoration(
                                          prefixIcon: PhilippineMobilePrefix(
                                            color: Theme.of(
                                              context,
                                            ).colorScheme.outline,
                                          ),
                                          prefixIconConstraints:
                                              const BoxConstraints(
                                                minWidth: 88,
                                              ),
                                          hintText: philippineMobileHint,
                                          hintStyle: GoogleFonts.inter(
                                            color: Color(0xFFD1D5DB),
                                          ),
                                          helperText: philippineMobileHelper,
                                          helperMaxLines: 2,
                                          contentPadding:
                                              const EdgeInsets.symmetric(
                                                vertical: 14,
                                              ),
                                          border: OutlineInputBorder(
                                            borderRadius: BorderRadius.circular(
                                              12,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 16),
                                    _InputField(
                                      label: "Recovery Email",
                                      child: TextFormField(
                                        controller: _emailCtrl,
                                        onChanged: (_) => setState(() {}),
                                        enabled: _isEditing,
                                        validator: (value) =>
                                            validateRecoveryEmail(value),
                                        keyboardType:
                                            TextInputType.emailAddress,
                                        style: GoogleFonts.inter(),
                                        decoration: InputDecoration(
                                          prefixIcon: Icon(
                                            LucideIcons.mail,
                                            color: Theme.of(
                                              context,
                                            ).colorScheme.outline,
                                          ),
                                          hintText: _isEditing
                                              ? 'juandelacruz@example.com'
                                              : 'No recovery email saved',
                                          helperText: _isEditing
                                              ? 'Used when you choose email recovery.'
                                              : _emailCtrl.text.trim().isEmpty
                                              ? 'No recovery email saved. Use SMS to recover your account.'
                                              : 'Recovery codes can be sent to this saved address.',
                                          helperMaxLines: 3,
                                          hintStyle: GoogleFonts.inter(
                                            color: Color(0xFFD1D5DB),
                                          ),
                                          contentPadding:
                                              const EdgeInsets.symmetric(
                                                vertical: 14,
                                              ),
                                          border: OutlineInputBorder(
                                            borderRadius: BorderRadius.circular(
                                              12,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),

                                    if (_isEditing && _contactChanged) ...[
                                      const SizedBox(height: 16),
                                      _InputField(
                                        label: 'Current Password',
                                        child: TextFormField(
                                          key: const ValueKey(
                                            'contact-current-password',
                                          ),
                                          controller: _currentPasswordCtrl,
                                          enabled: !_loading,
                                          obscureText: !_showCurrentPassword,
                                          autofillHints: const [
                                            AutofillHints.password,
                                          ],
                                          inputFormatters: [
                                            LengthLimitingTextInputFormatter(
                                              256,
                                            ),
                                          ],
                                          validator: (value) =>
                                              _contactChanged &&
                                                  (value == null ||
                                                      value.isEmpty)
                                              ? 'Enter your current password to change recovery details.'
                                              : null,
                                          decoration: InputDecoration(
                                            suffixIcon: IconButton(
                                              tooltip: _showCurrentPassword
                                                  ? 'Hide password'
                                                  : 'Show password',
                                              onPressed: () => setState(
                                                () => _showCurrentPassword =
                                                    !_showCurrentPassword,
                                              ),
                                              icon: Icon(
                                                _showCurrentPassword
                                                    ? LucideIcons.eye
                                                    : LucideIcons.eyeOff,
                                              ),
                                            ),
                                          ),
                                        ),
                                      ),
                                    ],
                                    const SizedBox(height: 24),

                                    SizedBox(
                                      width: double.infinity,
                                      child: ElevatedButton(
                                        onPressed: _loading
                                            ? null
                                            : _isEditing
                                            ? _submit
                                            : () {
                                                setState(() {
                                                  _isEditing = true;
                                                });
                                              },
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: const Color(
                                            0xFF134c8c,
                                          ),
                                          foregroundColor: Colors.white,
                                          shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(
                                              14,
                                            ),
                                          ),
                                          elevation: 0,
                                        ),
                                        child: _loading
                                            ? const SizedBox(
                                                width: 20,
                                                height: 20,
                                                child: AppLoadingIndicator(
                                                  size: 20,
                                                  strokeWidth: 2,
                                                  color: Colors.white,
                                                ),
                                              )
                                            : _isEditing
                                            ? Row(
                                                mainAxisAlignment:
                                                    MainAxisAlignment.center,
                                                children: [
                                                  Icon(LucideIcons.save),
                                                  SizedBox(width: 10),
                                                  Text(
                                                    "Save changes",
                                                    style: GoogleFonts.inter(
                                                      fontWeight:
                                                          FontWeight.w800,
                                                    ),
                                                  ),
                                                ],
                                              )
                                            : Row(
                                                mainAxisAlignment:
                                                    MainAxisAlignment.center,
                                                children: [
                                                  Icon(LucideIcons.pencil),
                                                  SizedBox(width: 10),
                                                  Text(
                                                    "Edit profile",
                                                    style: GoogleFonts.inter(
                                                      fontWeight:
                                                          FontWeight.w800,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InputField extends StatelessWidget {
  final String label;
  final Widget child;

  const _InputField({required this.label, required this.child});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500),
        ),
        const SizedBox(height: 6),
        Theme(
          data: Theme.of(context).copyWith(
            inputDecorationTheme: InputDecorationTheme(
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 14,
                vertical: 14,
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(
                  color: Color(0xFF134c8c),
                  width: 2,
                ),
              ),
            ),
          ),
          child: child,
        ),
      ],
    );
  }
}
