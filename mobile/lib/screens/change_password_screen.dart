import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:foodsafe_manila/services/session.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../services/api_service.dart';
import '../services/api_client.dart';
import '../utils/philippine_mobile_number.dart';
import '../widgets/app_loading.dart';
import '../widgets/philippine_mobile_prefix.dart';
import '../widgets/snackbar_widgets.dart';

class ChangePasswordScreen extends StatefulWidget {
  final bool isForgot;
  const ChangePasswordScreen({super.key, this.isForgot = false});

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _formKey = GlobalKey<FormState>();

  final _phoneCtrl = TextEditingController(); // NEW
  final _emailCtrl = TextEditingController();
  bool _useEmail = false;
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
  int _resendSeconds = 0;
  Timer? _resendTimer;
  String? _verificationToken;
  bool _otpSent = false;

  @override
  void initState() {
    super.initState();

    otpControllers = List.generate(6, (_) => TextEditingController());
    otpFocusNodes = List.generate(6, (_) => FocusNode());
  }

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _otpCtrl.dispose();
    _newPassCtrl.dispose();
    _confirmPassCtrl.dispose();

    for (var c in otpControllers) {
      c.dispose();
    }
    for (var f in otpFocusNodes) {
      f.dispose();
    }

    _resendTimer?.cancel();
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

  void _startResendTimer() {
    _resendTimer?.cancel();
    setState(() => _resendSeconds = 60);
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_resendSeconds <= 1) {
        timer.cancel();
        setState(() => _resendSeconds = 0);
      } else {
        setState(() => _resendSeconds--);
      }
    });
  }

  Future<bool> _sendOTP({bool forceNew = false}) async {
    setState(() => _loading = true);

    try {
      if (_useEmail) {
        final email = _emailCtrl.text.trim();

        final exists = await ApiService.checkEmailExists(email);

        if (exists) {
          await ApiService.sendEmailOtp(
            email: email,
            purpose: 'password_reset',
          );
        }
      } else {
        final phone = toLocalPhilippineMobileNumber(_phoneCtrl.text);

        final exists = await ApiService.checkPhoneExists(phone);

        if (exists) {
          await ApiService.sendMobileOtp(
            phone: phone,
            purpose: 'password_reset',
          );
        }
      }

      if (!mounted) return false;

      _verificationToken = null;
      _otpSent = true;

      if (forceNew) {
        for (final controller in otpControllers) {
          controller.clear();
        }

        _otpCtrl.clear();
      }

      _startResendTimer();

      return true;
    } catch (error) {
      if (mounted) {
        SnackbarWidgets.error(context, ApiClient.safeErrorMessage(error));
      }

      return false;
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _confirmCancelPasswordChange() async {
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
          "Your password change will be cancelled. The verification code will no longer be used. Are you sure?",
          style: GoogleFonts.inter(),
        ),
        actions: [
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () {
                    // Keep changing password
                    Navigator.pop(context, true);
                  },
                  style: OutlinedButton.styleFrom(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    side: const BorderSide(color: Color(0xFF2563EB)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: Text(
                    "Yes",
                    style: GoogleFonts.inter(
                      fontWeight: FontWeight.w500,
                      color: const Color(0xFF2563EB),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {
                    // Cancel password change
                    Navigator.pop(context, false);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
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

    if (!mounted || confirm != true) return;

    if (_useEmail) {
      await ApiService.cancelEmailOtp(
        email: _emailCtrl.text.trim(),
        purpose: 'password_reset',
      );
    }

    // Dispose/invalidate the current OTP flow locally.
    _resendTimer?.cancel();

    for (final controller in otpControllers) {
      controller.clear();
    }

    _otpCtrl.clear();

    setState(() {
      _otpSent = false;
      _verificationToken = null;
      _resendSeconds = 0;
    });

    // Exit the password-change screen.
    if (mounted) {
      Navigator.pop(context);
    }
  }

  Future<void> _nextStep() async {
    FocusScope.of(context).unfocus();

    // STEP 0: Phone / Email
    if (_currentStep == 0) {
      if (!_formKey.currentState!.validate()) return;

      setState(() => _currentStep = 1);

      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        FocusScope.of(context).requestFocus(_passFocus);
      });

      return;
    }

    // STEP 1: New Password
    if (_currentStep == 1) {
      if (!_formKey.currentState!.validate()) return;

      setState(() => _loading = true);

      try {
        // Only send the OTP the first time we enter the OTP step.
        if (!_otpSent) {
          if (_useEmail) {
            final email = _emailCtrl.text.trim();

            final exists = await ApiService.checkEmailExists(email);

            if (exists) {
              await ApiService.sendEmailOtp(
                email: email,
                purpose: 'password_reset',
              );
            }
          } else {
            final phone = toLocalPhilippineMobileNumber(_phoneCtrl.text);

            final exists = await ApiService.checkPhoneExists(phone);

            if (exists) {
              await ApiService.sendMobileOtp(
                phone: phone,
                purpose: 'password_reset',
              );
            }
          }

          if (!mounted) return;

          _otpSent = true;
          _verificationToken = null;
          _startResendTimer();

          SnackbarWidgets.info(
            context,
            "We've sent a verification code to your ${_useEmail ? 'email' : 'phone number'}",
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
          SnackbarWidgets.error(context, ApiClient.safeErrorMessage(error));
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
      if (_otpCtrl.text.length != 6) {
        SnackbarWidgets.error(
          context,
          "Please enter the 6-digit verification code",
        );
        return;
      }

      setState(() => _loading = true);

      try {
        // Verify OTP
        if (_useEmail) {
          _verificationToken = await ApiService.verifyEmailOtp(
            email: _emailCtrl.text.trim(),
            purpose: 'password_reset',
            otp: _otpCtrl.text,
          );
        } else {
          _verificationToken = await ApiService.verifyMobileOtp(
            phone: toLocalPhilippineMobileNumber(_phoneCtrl.text),
            purpose: 'password_reset',
            otp: _otpCtrl.text,
          );
        }

        if (!mounted) return;

        // OTP was valid, now update password.
        final success = await ApiService.updatePassword(
          email: _useEmail ? _emailCtrl.text.trim() : null,
          phone: _useEmail
              ? null
              : toLocalPhilippineMobileNumber(_phoneCtrl.text),
          newPassword: _newPassCtrl.text,
          verificationToken: _verificationToken!,
        );

        if (!mounted) return;

        if (success) {
          SnackbarWidgets.success(context, "Password updated successfully");

          Navigator.pop(context);
        }
      } catch (error) {
        if (mounted) {
          SnackbarWidgets.error(context, ApiClient.safeErrorMessage(error));
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
    return Scaffold(
      backgroundColor: Colors.white,
      body: PopScope(
        canPop: _currentStep != 2,
        onPopInvokedWithResult: (didPop, result) async {
          if (didPop) return;

          if (_currentStep == 2) {
            await _confirmCancelPasswordChange();
          }
        },
        child: SafeArea(
          top: true,
          child: Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF2563EB), Color(0xFF1D4ED8)],
              ),
            ),
            child: SingleChildScrollView(
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 24, 16, 24),
                    child: Column(
                      children: [
                        Align(
                          alignment: Alignment.centerLeft,
                          child: InkWell(
                            onTap: () async {
                              if (_currentStep == 2) {
                                await _confirmCancelPasswordChange();
                                return;
                              }

                              Navigator.pop(context);
                            },
                            child: Row(
                              children: [
                                Icon(
                                  LucideIcons.chevronLeft,
                                  color: Colors.white70,
                                ),
                                SizedBox(width: 4),
                                Text(
                                  "Back",
                                  style: GoogleFonts.inter(
                                    color: Colors.white70,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        Image.asset('assets/foodsafe_logo.png'),
                      ],
                    ),
                  ),
                  // White sheet (but still in SAME scroll)
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.vertical(
                        top: Radius.circular(24),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Form(
                          key: _formKey,
                          autovalidateMode: AutovalidateMode.onUserInteraction,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const SizedBox(height: 20),
                              _stepProgressBar(),
                              const SizedBox(height: 20),
                              _buildStepContent(),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _stepProgressBar() {
    int totalSteps = 3;

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: List.generate(totalSteps, (index) {
        bool isActive = index <= _currentStep;
        return Expanded(
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 4),
            height: 6,
            decoration: BoxDecoration(
              color: isActive ? const Color(0xFF2563EB) : Colors.grey.shade300,
              borderRadius: BorderRadius.circular(3),
            ),
          ),
        );
      }),
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
          _useEmail
              ? "Enter your recovery email and we'll send you a one-time reset code."
              : "Enter your registered phone number and we'll send you a one-time reset code.",
          style: GoogleFonts.inter(
            fontSize: 13,
            color: const Color(0xFF4B5563),
          ),
        ),

        const SizedBox(height: 14),

        if (_useEmail)
          _LabeledField(
            label: "Email Address",
            child: TextFormField(
              key: const ValueKey('email-field'),
              controller: _emailCtrl,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.done,
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return "Email is required";
                }

                final emailRegex = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

                if (!emailRegex.hasMatch(value.trim())) {
                  return "Enter a valid email address";
                }

                return null;
              },
              style: GoogleFonts.inter(),
              decoration: InputDecoration(
                hintText: "Enter your email",
                hintStyle: GoogleFonts.inter(color: const Color(0xFFD1D5DB)),
                prefixIcon: const Icon(
                  LucideIcons.mail,
                  color: Color(0xFF6B7280),
                ),
              ),
            ),
          )
        else
          _LabeledField(
            label: "Phone Number",
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
                prefixIcon: const PhilippineMobilePrefix(),
                prefixIconConstraints: const BoxConstraints(minWidth: 88),
              ),
            ),
          ),

        const SizedBox(height: 6),

        TextButton(
          onPressed: _loading
              ? null
              : () {
                  setState(() {
                    _useEmail = !_useEmail;

                    // The verification target changed,
                    // so a new OTP flow is required.
                    _otpSent = false;
                    _verificationToken = null;
                    _resendTimer?.cancel();
                    _resendSeconds = 0;

                    for (final controller in otpControllers) {
                      controller.clear();
                    }

                    _otpCtrl.clear();
                  });
                },
          style: TextButton.styleFrom(
            padding: EdgeInsets.zero,
            minimumSize: Size.zero,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          child: Text(
            _useEmail ? "Use phone number" : "Use recovery email",
            style: GoogleFonts.inter(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF2563EB),
            ),
          ),
        ),

        const SizedBox(height: 20),

        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _loading ? null : _nextStep,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2563EB),
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
                    "Submit",
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
              ? "Enter the 6-digit OTP sent to your email."
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
                        color: Color(0xFF3B82F6),
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

        Row(
          children: [
            Text('Did not receive code?', style: GoogleFonts.inter()),
            TextButton(
              onPressed: _resendSeconds > 0
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
                      : const Color(0xFF2563EB),
                ),
              ),
            ),
          ],
        ),

        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _loading ? null : _nextStep,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2563EB),
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
        _LabeledField(
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

        _LabeledField(
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
                onPressed: () => setState(() => _currentStep--),
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
                  backgroundColor: const Color(0xFF2563EB),
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

class _LabeledField extends StatelessWidget {
  final String label;
  final Widget child;

  const _LabeledField({required this.label, required this.child});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: Color(0xFF111827),
          ),
        ),
        const SizedBox(height: 8),
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
                  color: Color(0xFF3B82F6),
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
          child: child,
        ),
      ],
    );
  }
}
