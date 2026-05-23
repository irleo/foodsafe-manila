import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:foodsafe_manila/services/session.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../services/api_service.dart';
import '../services/otp_service.dart';
import '../widgets/snackbar_widgets.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotScreenState();
}

class _ForgotScreenState extends State<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();

  final _phoneCtrl = TextEditingController(); // NEW
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
    _phoneCtrl.dispose();
    _newPassCtrl.dispose();
    _confirmPassCtrl.dispose();

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

    // For forced resend, restart always. For step navigation with existing timer, do not reset.
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

    if (!_formKey.currentState!.validate()) return;

    setState(() => _loading = true);

    try {
      String phone = _phoneCtrl.text.replaceAll(" ", "");

      bool success = await ApiService.updatePassword(
        phone: phone,
        newPassword: _newPassCtrl.text,
      );

      if (!mounted) return;

      if (success) {
        SnackbarWidgets.success(context, "Password updated successfully");

        Navigator.pop(context); // return to login
      } else {
        SnackbarWidgets.error(context, "Failed to update password");
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

      if (!exists) {
        SnackbarWidgets.error(context, "Invalid phone number");
        return;
      }

      _sendOTP();

      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        FocusScope.of(context).requestFocus(otpFocusNodes[0]);
      });

      setState(() => _currentStep = 1);
      return;
    }
    if (_currentStep == 1) {
      if (_otpService.isExpired) {
        SnackbarWidgets.error(context, "OTP expired. Please resend.");
        return;
      }

      if (!_otpService.validateOTP(_otpCtrl.text)) {
        SnackbarWidgets.error(context, "Invalid OTP");
        return;
      }

      setState(() => _currentStep = 2);

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
        return _otpStep();
      case 2:
        return _newPasswordStep();
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _phoneInfoStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(14),
          width: double.infinity,
          decoration: BoxDecoration(
            color: Color(0xFFEFF6FF),
            border: Border.all(color: Color(0xFFBFDBFE)),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Expanded(
            child: Text(
              "We'll send a verification code to your registered phone number via SMS. Use this code to reset your password.",
              style: GoogleFonts.inter(fontSize: 13, color: Colors.blue[800]),
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
        _helper("Enter the phone number you used during registration"),
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
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : Text(
                    "Send reset code",
                    style: GoogleFonts.inter(fontWeight: FontWeight.w800),
                  ),
          ),
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              'Remember your password?',
              style: GoogleFonts.inter(color: Colors.grey[600], fontSize: 13),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(
                'Sign in',
                style: GoogleFonts.inter(
                  color: const Color(0xFF2563EB),
                  fontWeight: FontWeight.w700,
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
                        child: CircularProgressIndicator(
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

  Widget _newPasswordStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle(
          "Account Security",
          "Set a new password for your account",
        ),
        _LabeledField(
          label: "New Password *",
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
                    child: CircularProgressIndicator(
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
