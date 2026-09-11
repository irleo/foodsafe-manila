import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../services/api_service.dart';
import '../services/session.dart';
import '../utils/philippine_mobile_number.dart';
import '../widgets/app_loading.dart';
import '../widgets/philippine_mobile_prefix.dart';
import '../widgets/snackbar_widgets.dart';

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

  bool _loading = false;
  bool _updated = false;
  bool _isEditing = false;

  // OTP verification related
  bool _isOtpVerificationMode = false;
  String? _pendingPhoneNumber;
  String? _originalPhoneNumber;
  final _otpCtrl = TextEditingController();
  late List<TextEditingController> otpControllers;
  late List<FocusNode> otpFocusNodes;
  final int _resendSeconds = 0;

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
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
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
          "Enter the 6-digit code sent to your phone number.",
          style: GoogleFonts.inter(fontSize: 14),
        ),
        const SizedBox(height: 30),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: List.generate(6, (index) {
            return SizedBox(
              height: 50,
              width: 48,
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
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.start,
          children: [
            Text('Did not receive code?', style: GoogleFonts.inter()),
            TextButton(
              onPressed: _resendSeconds > 0
                  ? null
                  : () {}, // Implement resend OTP logic here
              style: ButtonStyle(
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
        const SizedBox(height: 20),
        Row(
          children: [
            Expanded(
              child: ElevatedButton(
                onPressed: _loading
                    ? null
                    : () {}, // Implement verify OTP logic here
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
      // Enter OTP verification mode
      setState(() {
        _isOtpVerificationMode = true;
        _pendingPhoneNumber = _phoneCtrl.text.trim();
      });

      // Request focus on first OTP field after frame is built
      if (mounted) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) {
            FocusScope.of(context).requestFocus(otpFocusNodes[0]);
          }
        });
      }

      return;
    }

    // If no phone number change, update directly
    setState(() => _loading = true);

    try {
      if (user == null) return;

      final userId = (user!['_id'] ?? user!['id'])?.toString();
      if (userId == null || userId.isEmpty) return;

      final updatedUser = await ApiService.updateUser(
        id: userId,
        username: _nameCtrl.text.trim(),
        phone: toLocalPhilippineMobileNumber(_phoneCtrl.text),
        email: _emailCtrl.text.trim().isEmpty ? null : _emailCtrl.text.trim(),
      );

      if (!mounted) return;

      if (updatedUser != null) {
        await Session.saveCurrentUser(updatedUser);

        if (!mounted) return;

        _nameCtrl.text = updatedUser['username'] ?? '';

        final updatedPhone = updatedUser['phoneNumber']?.toString() ?? '';

        _originalPhoneNumber = toPhilippineMobileInput(updatedPhone);
        _phoneCtrl.text = _originalPhoneNumber!;

        _emailCtrl.text = updatedUser['email'] ?? '';

        _updated = true;
        _isEditing = false;

        SnackbarWidgets.success(context, "Profile updated successfully");
      } else {
        SnackbarWidgets.error(context, "Update failed");
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
                setState(() {
                  _isOtpVerificationMode = false;
                  _pendingPhoneNumber = null;
                });
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
                decoration: const BoxDecoration(
                  color: Color(0xFF134c8c)
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    InkWell(
                      onTap: _isOtpVerificationMode
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
                                              backgroundColor: Color(0xFF134c8c),
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
                                setState(() {
                                  _isOtpVerificationMode = false;
                                  _pendingPhoneNumber = null;
                                });
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
                                              backgroundColor: const Color(0xFF134c8c),
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
                                        enabled: _isEditing,
                                        validator: (v) {
                                          final value = (v ?? "").trim();
                                          if (value.isEmpty) {
                                            return null; // optional
                                          }
                                          final emailRegex = RegExp(
                                            r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$',
                                          );
                                          if (!emailRegex.hasMatch(value)) {
                                            return "Enter a valid email address.";
                                          }
                                          return null;
                                        },
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
                                          hintText: 'juandelacruz@example.com',
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
                                          backgroundColor: const Color(0xFF134c8c),
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
