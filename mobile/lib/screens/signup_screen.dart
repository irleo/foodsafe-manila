import 'dart:async';

import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:foodsafe_manila/widgets/snackbar_widgets.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';
import '../services/api_client.dart';
import '../utils/philippine_mobile_number.dart';
import '../widgets/app_loading.dart';
import '../widgets/philippine_mobile_prefix.dart';

class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _formKey = GlobalKey<FormState>();

  final _usernameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _confirmPassCtrl = TextEditingController();
  final _otpCtrl = TextEditingController();
  late List<TextEditingController> otpControllers;
  late List<FocusNode> otpFocusNodes;

  final passwordRegex = RegExp(
    r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])[^\s]{8,}$',
  );

  bool _showPass = false;
  bool _showConfirmPass = false;
  bool _loading = false;

  final _passFocus = FocusNode();
  final _confirmPassFocus = FocusNode();

  int _currentStep = 0;
  int _resendSeconds = 0;
  Timer? _resendTimer;

  @override
  void initState() {
    super.initState();

    otpControllers = List.generate(6, (_) => TextEditingController());
    otpFocusNodes = List.generate(6, (_) => FocusNode());
  }

  @override
  void dispose() {
    _usernameCtrl.dispose();
    _phoneCtrl.dispose();
    _passCtrl.dispose();
    _confirmPassCtrl.dispose();
    _passFocus.dispose();
    _confirmPassFocus.dispose();
    _otpCtrl.dispose();

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
      final phone = toLocalPhilippineMobileNumber(_phoneCtrl.text);
      await ApiService.sendMobileOtp(phone: phone, purpose: 'registration');
      if (!mounted) return false;

      if (forceNew) {
        for (final controller in otpControllers) {
          controller.clear();
        }
        _otpCtrl.clear();
      }

      _startResendTimer();
      SnackbarWidgets.success(context, "Verification code sent");
      return true;
    } catch (error) {
      if (mounted) {
        SnackbarWidgets.error(context, ApiClient.safeErrorMessage(error));
      }
      return false;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _confirmCancelSignup() async {
    final confirm = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          "Cancel registration?",
          style: GoogleFonts.inter(fontWeight: FontWeight.w600),
        ),
        content: Text(
          "Your account registration will be cancelled. "
          "The verification code will no longer be used. Are you sure?",
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
    _resendTimer?.cancel();
    for (final controller in otpControllers) {
      controller.clear();
    }
    _otpCtrl.clear();
    if (mounted) {
      Navigator.pop(context);
    }
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();

    setState(() => _loading = true);

    try {
      final phone = toLocalPhilippineMobileNumber(_phoneCtrl.text);
      final verificationToken = await ApiService.verifyMobileOtp(
        phone: phone,
        purpose: 'registration',
        otp: _otpCtrl.text,
      );

      bool success = await ApiService.registerUser(
        username: _usernameCtrl.text.trim(),
        phone: phone,
        password: _passCtrl.text,
        verificationToken: verificationToken,
      );

      if (!mounted) return;

      if (success) {
        SnackbarWidgets.success(context, "Account created successfully");

        Navigator.pop(context); // return to login
      }
    } catch (error) {
      if (mounted) {
        SnackbarWidgets.error(context, ApiClient.safeErrorMessage(error));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _nextStep() async {
    if (_currentStep == 0) {
      FocusScope.of(context).unfocus();
      if (!_formKey.currentState!.validate()) return;

      setState(() => _loading = true);
      try {
        final phone = toLocalPhilippineMobileNumber(_phoneCtrl.text);
        final exists = await ApiService.checkPhoneExists(phone);
        if (!mounted) return;

        if (exists) {
          SnackbarWidgets.error(context, "Please check your information and try again.");
          return;
        }

        setState(() => _currentStep = 1);
      } catch (error) {
        if (mounted) {
          SnackbarWidgets.error(context, ApiClient.safeErrorMessage(error));
        }
      } finally {
        if (mounted) setState(() => _loading = false);
      }
      return;
    }
    if (_currentStep == 1) {
      if (!_formKey.currentState!.validate()) return;

      final sent = await _sendOTP();
      if (!sent || !mounted) return;
      setState(() => _currentStep = 2);

      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        FocusScope.of(context).requestFocus(otpFocusNodes[0]);
      });

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
            await _confirmCancelSignup();
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
                  /// HEADER
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 24, 16, 24),
                    child: Column(
                      children: [
                        Align(
                          alignment: Alignment.centerLeft,
                          child: InkWell(
                            onTap: () async {
                              if (_currentStep == 2) {
                                await _confirmCancelSignup();
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

                  /// WHITE SHEET
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.vertical(
                        top: Radius.circular(24),
                      ),
                    ),
                    child: Form(
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

  Widget _helper(String text) => Padding(
    padding: const EdgeInsets.only(top: 4),
    child: Text(
      text,
      style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF6B7280)),
    ),
  );

  Widget _buildStepContent() {
    switch (_currentStep) {
      case 0:
        return _personalInfoStep();
      case 1:
        return _accountSecurityStep();
      case 2:
        return _otpStep();
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _personalInfoStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle(
          "Create your account",
          "Fill up your personal information",
        ),
        _LabeledField(
          label: "Name",
          child: TextFormField(
            controller: _usernameCtrl,
            textInputAction: TextInputAction.next,
            validator: (v) {
              return (v == null || v.isEmpty || v.trim().isEmpty)
                  ? "Name is required"
                  : null;
            },
            style: GoogleFonts.inter(),
            decoration: InputDecoration(
              hintText: "Juan Dela Cruz",
              hintStyle: GoogleFonts.inter(color: Color(0xFFD1D5DB)),
              prefixIcon: Icon(LucideIcons.user),
            ),
          ),
        ),
        const SizedBox(height: 14),

        _LabeledField(
          label: "Phone Number",
          child: TextFormField(
            controller: _phoneCtrl,
            keyboardType: TextInputType.number,
            textInputAction: TextInputAction.done,
            inputFormatters: const [PhilippineMobileInputFormatter()],
            validator: validatePhilippineMobileInput,
            style: GoogleFonts.inter(),
            decoration: InputDecoration(
              hintText: philippineMobileHint,
              hintStyle: GoogleFonts.inter(color: Color(0xFFD1D5DB)),
              prefixIcon: const PhilippineMobilePrefix(),
              prefixIconConstraints: const BoxConstraints(minWidth: 88),
            ),
          ),
        ),
        _helper(philippineMobileHelper),
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

  Widget _accountSecurityStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle(
          "Set your password",
          'Must be at least 8 characters with uppercase, lowercase, numbers, and symbols',
        ),
        _LabeledField(
          label: "Password",
          child: TextFormField(
            controller: _passCtrl,
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
              hintText: "••••••••",
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
              if (v != _passCtrl.text) {
                return "Passwords do not match";
              }
              return null;
            },
            style: GoogleFonts.inter(),
            decoration: InputDecoration(
              hintText: "••••••••",
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

  Widget _otpStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          "Verification code",
          style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 10),
        Text("Enter the 6-digit OTP sent to your phone."),
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
        SizedBox(height: 16),
        Row(
          children: [
            Text('Did not receive code?', style: GoogleFonts.inter()),
            TextButton(
              onPressed: _resendSeconds > 0
                  ? null
                  : () {
                      _sendOTP(forceNew: true);
                    },
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
                      : const Color(0xFF2563EB),
                ),
              ),
            ),
          ],
        ),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _submit,
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
}

/// SHARED INPUT STYLE (SAME AS LOGIN)
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
            color: const Color(0xFF111827),
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
