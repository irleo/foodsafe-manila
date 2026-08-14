import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:foodsafe_manila/services/session.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../services/api_service.dart';
import '../utils/philippine_mobile_number.dart';
import '../widgets/app_loading.dart';
import '../widgets/philippine_mobile_prefix.dart';
import '../widgets/snackbar_widgets.dart';

class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
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
  Timer? _resendTimer;
  String? _verificationToken;

  @override
  void initState() {
    super.initState();

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

    _resendTimer?.cancel();
    super.dispose();
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
      await ApiService.sendMobileOtp(phone: phone, purpose: 'password_reset');
      if (!mounted) return false;

      _verificationToken = null;
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
      if (mounted) SnackbarWidgets.error(context, error.toString());
      return false;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();

    if (!_formKey.currentState!.validate()) return;

    setState(() => _loading = true);

    try {
      final phone = toLocalPhilippineMobileNumber(_phoneCtrl.text);

      bool success = await ApiService.updatePassword(
        phone: phone,
        newPassword: _newPassCtrl.text,
        verificationToken: _verificationToken!,
      );

      if (!mounted) return;

      if (success) {
        SnackbarWidgets.success(context, "Password updated successfully");

        Navigator.pop(context); // return to login
      }
    } catch (error) {
      if (mounted) SnackbarWidgets.error(context, error.toString());
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

        if (!exists) {
          SnackbarWidgets.error(context, "Phone number is not registered");
          return;
        }

        final sent = await _sendOTP();
        if (!sent || !mounted) return;

        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          FocusScope.of(context).requestFocus(otpFocusNodes[0]);
        });

        setState(() => _currentStep = 1);
      } catch (error) {
        if (mounted) SnackbarWidgets.error(context, error.toString());
      } finally {
        if (mounted) setState(() => _loading = false);
      }
      return;
    }
    if (_currentStep == 1) {
      setState(() => _loading = true);
      try {
        _verificationToken = await ApiService.verifyMobileOtp(
          phone: toLocalPhilippineMobileNumber(_phoneCtrl.text),
          purpose: 'password_reset',
          otp: _otpCtrl.text,
        );
        if (!mounted) return;
        setState(() => _currentStep = 2);
      } catch (error) {
        if (mounted) SnackbarWidgets.error(context, error.toString());
      } finally {
        if (mounted) setState(() => _loading = false);
      }
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
        Text(
          "Change password",
          style: GoogleFonts.inter(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: Color(0xFF111827),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          "Enter your registered phone number and we'll send you a one-time reset code.",
          style: GoogleFonts.inter(
            fontSize: 13,
            color: Color(0xFF4B5563),
          ),
        ),
        const SizedBox(height: 14),
        _LabeledField(
          label: "Phone Number *",
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
                    "Send reset code",
                    style: GoogleFonts.inter(fontWeight: FontWeight.w800),
                  ),
          ),
        ),
      ],
    );
  }

  Widget _otpStep() {
    // Autofill _otpCtrl when all 6 digits are entered.
    void updateOtp() {
      _otpCtrl.text = otpControllers.map((c) => c.text).join();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          "OTP verification",
          style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 10),
        Text("Enter the 6-digit OTP sent to your phone."),
        const SizedBox(height: 30),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: List.generate(6, (index) {
            return SizedBox(
              height: 64,
              width: 44,
              child: TextFormField(
                onChanged: (value) {
                  if (value.length == 1 && index < 5) {
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
        ),
      ],
    );
  }

  Widget _newPasswordStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle(
          "Change password",
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
