import 'package:foodsafe_manila/widgets/auth_form_field.dart';
import 'package:foodsafe_manila/widgets/step_progress_indicator.dart';
import 'package:foodsafe_manila/layout/auth_screen_layout.dart';
import 'package:foodsafe_manila/services/otp_flow.dart';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:foodsafe_manila/services/session.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'package:foodsafe_manila/services/api_service.dart';
import 'package:foodsafe_manila/services/api_client.dart';
import 'package:foodsafe_manila/utils/philippine_mobile_number.dart';
import 'package:foodsafe_manila/widgets/app_loading.dart';
import 'package:foodsafe_manila/widgets/philippine_mobile_prefix.dart';
import 'package:foodsafe_manila/widgets/snackbar_widgets.dart';

class ChangePasswordScreen extends StatefulWidget {
  final bool isForgot;
  const ChangePasswordScreen({super.key, this.isForgot = false});

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _formKey = GlobalKey<FormState>();

  final _phoneCtrl = TextEditingController(); // NEW
  bool _useEmail = false;
  String? _emailFlowId;
  String? _emailFlowPhone;
  final _otpCtrl = TextEditingController();
  late List<TextEditingController> otpControllers;
  late List<FocusNode> otpFocusNodes;
  final _newPassCtrl = TextEditingController(); // NEW
  final _confirmPassCtrl = TextEditingController();

  final passwordRegex = RegExp(
    r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$',
  );

  final user = Session.currentUser;

  bool _showPass = false;
  bool _showConfirmPass = false;
  bool _loading = false;

  final _passFocus = FocusNode();
  final _confirmPassFocus = FocusNode();

  int _currentStep = 0;
  final _otpFlow = OtpFlow();
  String? _otpError;
  int get _resendSeconds => _otpFlow.retryAfterSeconds;
  void _otpChanged() {
    if (mounted) setState(() {});
  }

  bool _otpSent = false;

  @override
  void initState() {
    super.initState();
    _otpFlow.addListener(_otpChanged);

    otpControllers = List.generate(6, (_) => TextEditingController());
    otpFocusNodes = List.generate(6, (_) => FocusNode());
  }

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _otpCtrl.dispose();
    _newPassCtrl.dispose();
    _confirmPassCtrl.dispose();

    for (var c in otpControllers) {
      c.dispose();
    }
    for (var f in otpFocusNodes) {
      f.dispose();
    }

    _otpFlow.dispose();
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

  void _selectRecoveryMethod(Set<bool> selection) {
    final useEmail = selection.single;
    if (_loading || useEmail == _useEmail) return;
    setState(() {
      _useEmail = useEmail;
      _emailFlowId = null;
      _emailFlowPhone = null;
      _otpSent = false;
      _otpError = null;
      _otpFlow.clear();
      for (final controller in otpControllers) {
        controller.clear();
      }
      _otpCtrl.clear();
    });
  }

  Future<bool> _isIdentifierLinkedToAccount() async {
    if (widget.isForgot) {
      return _useEmail
          ? true
          : ApiService.checkPhoneExists(
              toLocalPhilippineMobileNumber(_phoneCtrl.text),
            );
    }

    final currentUser = user;
    if (currentUser == null) return false;

    final accountPhone = currentUser['phoneNumber']?.toString();
    if (accountPhone == null || accountPhone.isEmpty) return false;

    return toLocalPhilippineMobileNumber(_phoneCtrl.text) ==
        toLocalPhilippineMobileNumber(toPhilippineMobileInput(accountPhone));
  }

  Future<bool> _guardAccountIdentifier() async {
    final isLinked = await _isIdentifierLinkedToAccount();
    if (!isLinked && mounted) {
      SnackbarWidgets.info(
        context,
        "Please check your information and try again.",
      );
      return false;
    }
    return true;
  }

  Future<OtpSendResult?> _sendPasswordResetOtp() async {
    if (!await _guardAccountIdentifier() || !mounted) return null;

    if (_useEmail) {
      final phone = toLocalPhilippineMobileNumber(_phoneCtrl.text);
      final result = await ApiService.sendEmailOtp(
        phone: phone,
        purpose: 'password_reset',
        flowId: !_otpFlow.expired && _emailFlowPhone == phone
            ? _emailFlowId
            : null,
      );
      if (!mounted) return null;
      _emailFlowId = result.flowId;
      _emailFlowPhone = phone;
      return result;
    } else {
      return ApiService.sendMobileOtp(
        phone: toLocalPhilippineMobileNumber(_phoneCtrl.text),
        purpose: 'password_reset',
      );
    }
  }

  Future<bool> _sendOTP({bool forceNew = false}) async {
    if (_loading || _resendSeconds > 0) return false;
    setState(() => _loading = true);

    try {
      final sent = await _sendPasswordResetOtp();
      if (sent == null) return false;

      if (!mounted) return false;

      _otpSent = true;

      if (forceNew) {
        for (final controller in otpControllers) {
          controller.clear();
        }

        _otpCtrl.clear();
      }

      _otpError = null;
      _otpFlow.sent(sent);

      return true;
    } catch (error) {
      if (mounted) {
        if (error is ApiException && error.retryAfterSeconds != null) {
          _otpFlow.cooldown(error.retryAfterSeconds!);
        }
        SnackbarWidgets.error(
          context,
          ApiClient.safeErrorMessage(
            error,
            fallback: "We couldn't send your recovery code. Please try again.",
          ),
        );
      }

      return false;
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _confirmCancelPasswordChange() async {
    if (_loading) return;
    final confirm = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          "Cancel password change?",
          style: GoogleFonts.inter(fontWeight: FontWeight.w600),
        ),
        content: Text(
          "Leave without changing your password? Unused verification codes expire automatically.",
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
                    "Leave",
                    style: GoogleFonts.inter(
                      fontWeight: FontWeight.w500,
                      color: const Color(0xFF134c8c),
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
                    "Stay",
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

    if (!mounted || confirm != true) return;

    // Clear only local input; the server challenge and cooldown remain intact.
    _otpFlow.clear();

    for (final controller in otpControllers) {
      controller.clear();
    }

    _otpCtrl.clear();

    setState(() {
      _otpSent = false;
    });

    // Exit the password-change screen.
    if (mounted) {
      Navigator.pop(context);
    }
  }

  Future<void> _nextStep() async {
    if (_loading) return;
    FocusScope.of(context).unfocus();

    // STEP 0: Account and recovery destination
    if (_currentStep == 0) {
      if (!_formKey.currentState!.validate()) return;

      setState(() => _loading = true);
      try {
        if (!await _guardAccountIdentifier() || !mounted) return;

        setState(() => _currentStep = 1);
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          FocusScope.of(context).requestFocus(_passFocus);
        });
      } catch (error) {
        if (mounted) {
          SnackbarWidgets.error(
            context,
            ApiClient.safeErrorMessage(
              error,
              fallback:
                  "We couldn't check your recovery details. Please try again.",
            ),
          );
        }
      } finally {
        if (mounted) setState(() => _loading = false);
      }

      return;
    }

    // STEP 1: New Password
    if (_currentStep == 1) {
      if (!_otpSent && _resendSeconds > 0) return;
      if (!_formKey.currentState!.validate()) return;

      setState(() => _loading = true);

      try {
        // Only send the OTP the first time we enter the OTP step.
        if (!_otpSent) {
          final sent = await _sendPasswordResetOtp();
          if (sent == null) return;

          if (!mounted) return;

          _otpSent = true;
          _otpFlow.sent(sent);

          SnackbarWidgets.info(
            context,
            _useEmail
                ? 'If this account has a recovery email, a code will be sent there.'
                : "We've sent a verification code to your phone number",
          );
        }

        if (!mounted) return;

        // Always proceed to OTP.
        setState(() => _currentStep = 2);

        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          FocusScope.of(context).requestFocus(otpFocusNodes[0]);
        });
      } catch (error) {
        if (mounted) {
          if (error is ApiException && error.retryAfterSeconds != null) {
            _otpFlow.cooldown(error.retryAfterSeconds!);
          }
          SnackbarWidgets.error(
            context,
            ApiClient.safeErrorMessage(
              error,
              fallback:
                  "We couldn't send your recovery code. Please try again.",
            ),
          );
        }
      } finally {
        if (mounted) {
          setState(() => _loading = false);
        }
      }

      return;
    }

    // STEP 2: OTP
    if (_currentStep == 2) {
      if (_otpFlow.expired) return;
      if (_otpFlow.verificationToken == null && _otpCtrl.text.length != 6) {
        SnackbarWidgets.error(
          context,
          "Please enter the 6-digit verification code",
        );
        return;
      }

      setState(() => _loading = true);

      try {
        // Verify OTP
        if (_otpFlow.verificationToken == null) {
          final proof = _useEmail
              ? await ApiService.verifyEmailOtp(
                  phone: toLocalPhilippineMobileNumber(_phoneCtrl.text),
                  flowId: _emailFlowId!,
                  purpose: 'password_reset',
                  otp: _otpCtrl.text,
                )
              : await ApiService.verifyMobileOtp(
                  phone: toLocalPhilippineMobileNumber(_phoneCtrl.text),
                  purpose: 'password_reset',
                  otp: _otpCtrl.text,
                );
          if (!mounted) return;
          _otpFlow.verified(proof);
        }

        if (!mounted) return;

        // OTP was valid, now update password.
        final success = await ApiService.updatePassword(
          phone: toLocalPhilippineMobileNumber(_phoneCtrl.text),
          recoveryMethod: _useEmail ? 'email' : 'sms',
          flowId: _useEmail ? _emailFlowId : null,
          newPassword: _newPassCtrl.text,
          verificationToken: _otpFlow.verificationToken!,
        );

        if (!mounted) return;

        if (success) {
          await Session.clear();
          if (!mounted) return;

          SnackbarWidgets.success(
            context,
            "Password updated successfully! Please sign in again",
          );
          Navigator.pop(context, true);
        }
      } catch (error) {
        if (mounted) {
          if (error is ApiException &&
              (error.code == 'PHONE_PROOF_INVALID' ||
                  error.code == 'EMAIL_PROOF_INVALID' ||
                  error.code == 'OTP_ATTEMPTS_EXCEEDED')) {
            _otpFlow.invalidate();
          }
          final message = ApiClient.safeErrorMessage(
            error,
            fallback:
                "We couldn't finish changing your password. Please try again before the code expires.",
          );
          setState(() => _otpError = message);
          SnackbarWidgets.error(context, message);
        }
      } finally {
        if (mounted) {
          setState(() => _loading = false);
        }
      }

      return;
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_loading && _currentStep != 2,
      onPopInvokedWithResult: (didPop, result) async {
        if (!didPop && _currentStep == 2) {
          await _confirmCancelPasswordChange();
        }
      },
      child: AuthScreenLayout(
        onBack: () async {
          if (_loading) return;
          if (_currentStep == 2) {
            await _confirmCancelPasswordChange();
          } else if (mounted) {
            Navigator.maybePop(context);
          }
        },
        child: Form(
          key: _formKey,
          autovalidateMode: AutovalidateMode.onUserInteraction,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              StepProgressIndicator(
                currentStep: _currentStep,
                titles: const ['Account info', 'New password', 'Verification'],
              ),
              const SizedBox(height: 20),
              _buildStepContent(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStepContent() {
    switch (_currentStep) {
      case 0:
        return _phoneInfoStep();
      case 1:
        return _newPasswordStep();
      case 2:
        return _otpStep();
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _phoneInfoStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          widget.isForgot ? 'Forgot password?' : 'Change password',
          style: GoogleFonts.inter(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF111827),
          ),
        ),

        const SizedBox(height: 4),

        Text(
          'Use your registered phone number to find your account.',
          style: GoogleFonts.inter(
            fontSize: 13,
            color: const Color(0xFF4B5563),
          ),
        ),

        const SizedBox(height: 14),

        AuthFormField(
          label: 'Registered phone number',
          child: TextFormField(
            key: const ValueKey('phone-field'),
            controller: _phoneCtrl,
            keyboardType: TextInputType.phone,
            textInputAction: TextInputAction.done,
            inputFormatters: const [PhilippineMobileInputFormatter()],
            validator: validatePhilippineMobileInput,
            style: GoogleFonts.inter(),
            decoration: InputDecoration(
              hintText: philippineMobileHint,
              hintStyle: GoogleFonts.inter(color: const Color(0xFFD1D5DB)),
              prefixIcon: PhilippineMobilePrefix(
                color: Theme.of(context).colorScheme.outline,
              ),
              prefixIconConstraints: const BoxConstraints(minWidth: 88),
            ),
          ),
        ),

        const SizedBox(height: 16),

        AuthFormField(
          label: 'Receive code via',
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final useEmail in [false, true])
                ChoiceChip(
                  key: ValueKey(useEmail ? 'recovery-email' : 'recovery-sms'),
                  label: Text(useEmail ? 'Saved recovery email' : 'SMS'),
                  avatar: Icon(
                    useEmail ? LucideIcons.mail : LucideIcons.messageSquare,
                    size: 18,
                    color: _useEmail == useEmail
                        ? Colors.white
                        : const Color(0xFF134c8c),
                  ),
                  selected: _useEmail == useEmail,
                  onSelected: _loading
                      ? null
                      : (_) => _selectRecoveryMethod({useEmail}),
                  selectedColor: const Color(0xFF134c8c),
                  backgroundColor: Colors.white,
                  checkmarkColor: Colors.white,
                  labelStyle: GoogleFonts.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: _useEmail == useEmail
                        ? Colors.white
                        : const Color(0xFF134c8c),
                  ),
                  labelPadding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 10,
                  ),
                  materialTapTargetSize: MaterialTapTargetSize.padded,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                    side: BorderSide(
                      color: _useEmail == useEmail
                          ? Colors.transparent
                          : const Color(0xFF134c8c),
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Text(
          _useEmail
              ? 'Only available if you previously added a recovery email.'
              : 'Code goes to your registered phone number.',
          style: GoogleFonts.inter(
            fontSize: 13,
            color: const Color(0xFF4B5563),
          ),
        ),

        const SizedBox(height: 20),

        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _loading ? null : _nextStep,
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
                    'Continue',
                    style: GoogleFonts.inter(fontWeight: FontWeight.w800),
                  ),
          ),
        ),
      ],
    );
  }

  Widget _otpStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          "Verification code",
          style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w800),
        ),

        const SizedBox(height: 4),

        Text(
          _useEmail
              ? 'If you saved a recovery email, check it for the 6-digit code.'
              : "Enter the 6-digit OTP sent to your phone.",
          style: GoogleFonts.inter(
            fontSize: 13,
            color: const Color(0xFF4B5563),
          ),
        ),

        const SizedBox(height: 30),

        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: List.generate(6, (index) {
            return SizedBox(
              height: 54,
              width: 50,
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
                    errorMaxLines: 2,
                    errorStyle: GoogleFonts.inter(
                      fontSize: 11,
                      color: const Color(0xFFDC2626),
                    ),
                  ),
                ),
              ),
            );
          }),
        ),

        const SizedBox(height: 16),

        if (_otpFlow.expired || _otpError != null)
          Semantics(
            liveRegion: true,
            child: Text(
              _otpFlow.expired
                  ? 'This verification has expired. Request a new code.'
                  : _otpError!,
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
                  : () {
                      _sendOTP(forceNew: true);
                    },
              style: const ButtonStyle(
                visualDensity: VisualDensity(horizontal: -4, vertical: -4),
              ),
              child: Text(
                _resendSeconds > 0
                    ? "Resend in $_resendSeconds s"
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

        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _loading || (_currentStep == 2 && _otpFlow.expired)
                ? null
                : _nextStep,
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
    );
  }

  Widget _newPasswordStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle(
          "Set new password",
          "Must be at least 8 characters with uppercase, lowercase, numbers, and symbols",
        ),
        AuthFormField(
          label: "New Password",
          child: TextFormField(
            controller: _newPassCtrl,
            focusNode: _passFocus,
            textInputAction: TextInputAction.next,
            onEditingComplete: () =>
                FocusScope.of(context).requestFocus(_confirmPassFocus),
            obscureText: !_showPass,
            validator: (v) {
              if (v == null || v.isEmpty) {
                return "Password is required";
              }
              if (!passwordRegex.hasMatch(v)) {
                return "Password must be at least 8 characters with uppercase, lowercase, numbers, and symbols";
              }
              return null;
            },
            style: GoogleFonts.inter(),
            decoration: InputDecoration(
              hintText: "Enter password",
              hintStyle: GoogleFonts.inter(color: Color(0xFFD1D5DB)),
              prefixIcon: const Icon(LucideIcons.lock),
              suffixIcon: IconButton(
                onPressed: () => setState(() => _showPass = !_showPass),
                icon: Icon(_showPass ? LucideIcons.eye : LucideIcons.eyeOff),
              ),
            ),
          ),
        ),

        const SizedBox(height: 14),

        AuthFormField(
          label: "Confirm Password",
          child: TextFormField(
            controller: _confirmPassCtrl,
            focusNode: _confirmPassFocus,
            textInputAction: TextInputAction.done,
            obscureText: !_showConfirmPass,
            validator: (v) {
              if (v != _newPassCtrl.text) {
                return "Passwords do not match";
              }
              return null;
            },
            style: GoogleFonts.inter(),
            decoration: InputDecoration(
              hintText: "Enter password",
              hintStyle: GoogleFonts.inter(color: Color(0xFFD1D5DB)),
              prefixIcon: const Icon(LucideIcons.lock),
              suffixIcon: IconButton(
                onPressed: () =>
                    setState(() => _showConfirmPass = !_showConfirmPass),
                icon: Icon(
                  _showConfirmPass ? LucideIcons.eye : LucideIcons.eyeOff,
                ),
              ),
            ),
          ),
        ),

        const SizedBox(height: 20),

        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: _loading
                    ? null
                    : () => setState(() => _currentStep--),
                style: OutlinedButton.styleFrom(
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  side: const BorderSide(color: Color(0xFFD1D5DB)),
                ),
                child: Text(
                  "Back",
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.w800,
                    color: Colors.black87,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: ElevatedButton(
                onPressed: _loading ? null : _nextStep,
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
                        "Confirm",
                        style: GoogleFonts.inter(fontWeight: FontWeight.w800),
                      ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _sectionTitle(String title, String subtitle) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 4),
        Text(
          subtitle,
          style: GoogleFonts.inter(
            fontSize: 13,
            color: const Color(0xFF4B5563),
          ),
        ),
      ],
    ),
  );
}
