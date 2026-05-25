import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../services/otp_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:foodsafe_manila/widgets/snackbar_widgets.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';
import '../widgets/app_loading.dart';

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
  bool _otpSnackbarShown = false;
  bool _otpTimerStarted = false;

  late OTPService _otpService;

  @override
  void initState() {
    super.initState();

    otpControllers = List.generate(4, (_) => TextEditingController());
    otpFocusNodes = List.generate(4, (_) => FocusNode());

    _otpService = OTPService();
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

    _otpService.stopResendTimer();

    super.dispose();
  }

  // Mock OTP generation
  void _sendOTP({bool forceNew = false}) {
    final wasExpired = _otpService.isExpired;
    final otp = _otpService.generateOTP(forceNew: forceNew);

    // Show OTP in snackbar once per generated OTP (or on explicit forced resend)
    if (forceNew || !_otpSnackbarShown || wasExpired) {
      _otpSnackbarShown = true;
      Future.delayed(const Duration(milliseconds: 800), () {
        if (!mounted) return;
        SnackbarWidgets.showTopNotification(context, otp);
      });
    }

    // Start timer only on first OTP send or explicit resend button click
    if (forceNew || !_otpTimerStarted) {
      _otpTimerStarted = true;
      _otpService.startResendTimer(
        onTick: (remaining) {
          if (!mounted) return;
          setState(() {
            _resendSeconds = remaining;
          });
        },
        onCompleted: () {
          if (!mounted) return;
          setState(() {
            _resendSeconds = 0;
          });
        },
      );
    }
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();

    if (_otpService.isExpired) {
      SnackbarWidgets.error(context, "OTP expired. Please resend.");
      return;
    }

    if (!_otpService.validateOTP(_otpCtrl.text)) {
      SnackbarWidgets.error(context, "Invalid OTP");
      return;
    }

    setState(() => _loading = true);

    try {
      String phone = _phoneCtrl.text.replaceAll(" ", "");

      bool success = await ApiService.registerUser(
        username: _usernameCtrl.text.trim(),
        phone: phone,
        password: _passCtrl.text,
      );

      if (!mounted) return;

      if (success) {
        SnackbarWidgets.success(context, "Account created successfully");

        Navigator.pop(context); // return to login
      } else {
        SnackbarWidgets.error(context, "Phone number already registered");
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _nextStep() async {
    if (_currentStep == 0) {
      // Validate personal info
      if (!_formKey.currentState!.validate()) return;

      String phone = _phoneCtrl.text.replaceAll(" ", "");
      final exists = await ApiService.checkPhoneExists(phone);

      if (!mounted) return;

      if (exists) {
        SnackbarWidgets.error(context, "Phone number already registered");
        return;
      }

      setState(() => _currentStep = 1);
      return;
    }
    if (_currentStep == 1) {
      if (!_formKey.currentState!.validate()) return;

      setState(() => _currentStep = 2);

      _sendOTP();

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
      body: SafeArea(
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
                          onTap: () => Navigator.pop(context),
                          child: Row(
                            children: [
                              Icon(
                                LucideIcons.chevronLeft,
                                color: Colors.white70,
                              ),
                              SizedBox(width: 4),
                              Text(
                                "Back",
                                style: GoogleFonts.inter(color: Colors.white70),
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
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: 20),
                        _stepProgressBar(),
                        const SizedBox(height: 20),
                        _buildStepContent(),
                        const SizedBox(height: 20),
                        Text(
                          "By creating an account, you agree to our Terms of Service and Privacy Policy. "
                          "Your data is protected under the Data Privacy Act of 2012.",
                          textAlign: TextAlign.center,
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            color: const Color(0xFF4B5563),
                            height: 1.35,
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

  String? _required(String? v) =>
      (v == null || v.isEmpty) ? "Required field" : null;

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
        _sectionTitle("Personal Information", "Tell us a bit about yourself"),
        _LabeledField(
          label: "Name *",
          child: TextFormField(
            controller: _usernameCtrl,
            textInputAction: TextInputAction.next,
            validator: _required,
            style: GoogleFonts.inter(),
            decoration: InputDecoration(
              hintText: "Enter name",
              hintStyle: GoogleFonts.inter(color: Color(0xFFD1D5DB)),
              prefixIcon: Icon(LucideIcons.user),
            ),
          ),
        ),
        const SizedBox(height: 14),

        _LabeledField(
          label: "Phone Number *",
          child: TextFormField(
            controller: _phoneCtrl,
            keyboardType: TextInputType.phone,
            textInputAction: TextInputAction.done,
            validator: (v) {
              final value = (v ?? "").trim();

              if (value.isEmpty) {
                return "Phone number is required.";
              }

              // remove all spaces
              String digitsOnly = value.replaceAll(RegExp(r'\s+'), '');

              // must be exactly 11 digits
              final phoneRegex = RegExp(r'^\d{11}$');

              if (!phoneRegex.hasMatch(digitsOnly)) {
                return "Enter a valid 11-digit phone number.";
              }
              return null;
            },

            style: GoogleFonts.inter(),
            decoration: InputDecoration(
              hintText: "Enter phone number",
              hintStyle: GoogleFonts.inter(color: Color(0xFFD1D5DB)),
              prefixIcon: Icon(LucideIcons.phone),
            ),
          ),
        ),
        const SizedBox(height: 20),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _nextStep,
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
                    "Next",
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
        _sectionTitle("Account Security", "Set a password for your account"),
        _LabeledField(
          label: "Password *",
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

        _helper(
          'Must be at least 8 characters with uppercase, lowercase, numbers, and symbols',
        ),

        const SizedBox(height: 14),

        _LabeledField(
          label: "Confirm Password *",
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
              hintText: "Confirm password",
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
                onPressed: _nextStep,
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
                        "Next",
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
    // Autofill _otpCtrl when all 4 digits entered
    void updateOtp() {
      _otpCtrl.text = otpControllers.map((c) => c.text).join();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          "OTP Verification",
          style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 10),
        Text("Enter the 4-digit OTP sent to your phone."),
        const SizedBox(height: 30),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: List.generate(4, (index) {
            return SizedBox(
              height: 64,
              width: 64,
              child: TextFormField(
                onChanged: (value) {
                  if (value.length == 1 && index < 3) {
                    // Move to next field
                    FocusScope.of(
                      context,
                    ).requestFocus(otpFocusNodes[index + 1]);
                  } else if (value.isEmpty && index > 0) {
                    // Move back if deleted
                    FocusScope.of(
                      context,
                    ).requestFocus(otpFocusNodes[index - 1]);
                  }
                  updateOtp();
                },
                style: GoogleFonts.inter(fontWeight: FontWeight.w800),
                decoration: InputDecoration(
                  contentPadding: const EdgeInsets.symmetric(vertical: 18),
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
                keyboardType: TextInputType.number,
                controller: otpControllers[index],
                focusNode: otpFocusNodes[index],
                textAlign: TextAlign.center,
                textAlignVertical: TextAlignVertical.center,
                inputFormatters: [
                  LengthLimitingTextInputFormatter(1),
                  FilteringTextInputFormatter.digitsOnly,
                ],
              ),
            );
          }),
        ),
        SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
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
        SizedBox(height: 10),
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
