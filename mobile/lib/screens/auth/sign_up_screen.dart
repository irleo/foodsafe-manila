import 'package:foodsafe_manila/widgets/auth_form_field.dart';
import 'package:foodsafe_manila/widgets/step_progress_indicator.dart';
import 'package:foodsafe_manila/services/otp_flow.dart';

import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:foodsafe_manila/widgets/snackbar_widgets.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:foodsafe_manila/services/api_service.dart';
import 'package:foodsafe_manila/services/api_client.dart';
import 'package:foodsafe_manila/utils/philippine_mobile_number.dart';
import 'package:foodsafe_manila/widgets/app_loading.dart';
import 'package:foodsafe_manila/widgets/philippine_mobile_prefix.dart';
import 'package:foodsafe_manila/services/policy_service.dart';
import 'package:foodsafe_manila/screens/legal/policy_screen.dart';
import 'package:foodsafe_manila/layout/auth_screen_layout.dart';

class SignUpScreen extends StatefulWidget {
  const SignUpScreen({super.key});

  @override
  State<SignUpScreen> createState() => _SignUpScreenState();
}

class _SignUpScreenState extends State<SignUpScreen> {
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
  PolicyBundle? _policies;
  bool _termsAccepted = false;
  bool _privacyAcknowledged = false;
  String? _policyError;
  final _otpFlow = OtpFlow();
  String? _otpError;

  final _passFocus = FocusNode();
  final _confirmPassFocus = FocusNode();

  int _currentStep = 0;
  int get _resendSeconds => _otpFlow.retryAfterSeconds;
  void _otpChanged() {
    if (mounted) setState(() {});
  }

  // Labels for the step indicator — keep in sync with _buildStepContent().
  static const List<String> _stepTitles = [
    "Personal info",
    "Security",
    "Verification",
  ];

  @override
  void initState() {
    super.initState();
    _otpFlow.addListener(_otpChanged);
    _loadPolicies();

    otpControllers = List.generate(6, (_) => TextEditingController());
    otpFocusNodes = List.generate(6, (_) => FocusNode());
  }

  Future<void> _loadPolicies() async {
    try {
      final bundle = await PolicyService.load();
      if (mounted) {
        setState(() {
          _policies = bundle;
          _policyError = null;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(
          () => _policyError = ApiClient.safeErrorMessage(
            error,
            fallback:
                "We couldn't load the account policies. Please try again.",
          ),
        );
      }
    }
  }

  bool get _policiesAccepted =>
      _policies?.accountPublished == true &&
      _termsAccepted &&
      _privacyAcknowledged;

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

  Future<bool> _sendOTP({bool forceNew = false}) async {
    if (_loading || _resendSeconds > 0) return false;
    setState(() => _loading = true);
    try {
      final phone = toLocalPhilippineMobileNumber(_phoneCtrl.text);
      final result = await ApiService.sendMobileOtp(
        phone: phone,
        purpose: 'registration',
      );
      if (!mounted) return false;

      if (forceNew) {
        for (final controller in otpControllers) {
          controller.clear();
        }
        _otpCtrl.clear();
      }

      _otpError = null;
      _otpFlow.sent(result);
      SnackbarWidgets.info(
        context,
        "We've sent a verification code to your phone number",
      );
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
            fallback:
                "We couldn't send your registration code. Please try again.",
          ),
        );
      }
      return false;
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _confirmCancelSignup() async {
    if (_loading) return;
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
                    side: const BorderSide(color: Color(0xFF134c8c)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: Text(
                    "Yes",
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
    _otpFlow.clear();
    for (final controller in otpControllers) {
      controller.clear();
    }
    _otpCtrl.clear();
    if (mounted) {
      Navigator.pop(context);
    }
  }

  Future<void> _submit() async {
    if (!_policiesAccepted || _loading) return;
    if (_otpFlow.expired) return;
    if (_otpFlow.verificationToken == null && _otpCtrl.text.length != 6) {
      setState(() => _otpError = 'Enter the 6-digit verification code');
      return;
    }
    FocusScope.of(context).unfocus();

    setState(() => _loading = true);

    try {
      final phone = toLocalPhilippineMobileNumber(_phoneCtrl.text);
      if (_otpFlow.verificationToken == null) {
        final proof = await ApiService.verifyMobileOtp(
          phone: phone,
          purpose: 'registration',
          otp: _otpCtrl.text,
        );
        if (!mounted) return;
        _otpFlow.verified(proof);
      }

      bool success = await ApiService.registerUser(
        username: _usernameCtrl.text.trim(),
        phone: phone,
        password: _passCtrl.text,
        verificationToken: _otpFlow.verificationToken!,
        policyAcceptance: _policies!.accountChoices,
      );

      if (!mounted) return;

      if (success) {
        SnackbarWidgets.success(context, "Account created successfully");

        Navigator.pop(context); // return to login
      }
    } catch (error) {
      if (mounted) {
        if (error is ApiException &&
            (error.code == 'PHONE_PROOF_INVALID' ||
                error.code == 'OTP_ATTEMPTS_EXCEEDED')) {
          _otpFlow.invalidate();
        }
        final message = ApiClient.safeErrorMessage(
          error,
          fallback:
              "We couldn't finish registration. Please try again before the code expires.",
        );
        setState(() => _otpError = message);
        SnackbarWidgets.error(context, message);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _nextStep() async {
    if (_loading) return;
    if (!_policiesAccepted) {
      SnackbarWidgets.info(
        context,
        'Accept the current Terms and acknowledge the Privacy Policy.',
      );
      return;
    }
    if (_currentStep == 0) {
      FocusScope.of(context).unfocus();
      if (!_formKey.currentState!.validate()) return;

      setState(() => _loading = true);
      try {
        final phone = toLocalPhilippineMobileNumber(_phoneCtrl.text);
        final exists = await ApiService.checkPhoneExists(phone);
        if (!mounted) return;

        if (exists) {
          SnackbarWidgets.info(
            context,
            'This mobile number already has an account. Please sign in or use Forgot Password.',
          );
          return;
        }

        setState(() => _currentStep = 1);
      } catch (error) {
        if (mounted) {
          SnackbarWidgets.error(
            context,
            ApiClient.safeErrorMessage(
              error,
              fallback:
                  "We couldn't check this mobile number. Please try again.",
            ),
          );
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
    return PopScope(
      canPop: !_loading && _currentStep != 2,
      onPopInvokedWithResult: (didPop, result) async {
        if (!didPop && _currentStep == 2) await _confirmCancelSignup();
      },
      child: AuthScreenLayout(
        onBack: () async {
          if (_loading) return;
          if (_currentStep == 2) {
            await _confirmCancelSignup();
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
                titles: _stepTitles,
              ),
              const SizedBox(height: 20),
              _buildStepContent(),
            ],
          ),
        ),
      ),
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
        AuthFormField(
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

        AuthFormField(
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
        const SizedBox(height: 16),

        // Consent checkboxes grouped into a shaded panel instead of
        // floating loosely in the form — reads as one "agree to continue"
        // unit rather than two stray form fields.
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFFF1F3F6),
            borderRadius: BorderRadius.circular(14),
          ),
          child: PolicyChoices(
            termsAccepted: _termsAccepted,
            privacyAcknowledged: _privacyAcknowledged,
            enabled: !_loading,
            showLinks: false,
            inlineLinks: true,
            onTermsChanged: (value) => setState(() => _termsAccepted = value),
            onPrivacyChanged: (value) =>
                setState(() => _privacyAcknowledged = value),
          ),
        ),
        if (_policyError != null) ...[
          Text(_policyError!),
          TextButton(onPressed: _loadPolicies, child: const Text('Retry')),
        ],
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
                // Renamed from "Submit" — this only advances to step 2,
                // it doesn't create the account yet.
                : Text(
                    "Continue",
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
        AuthFormField(
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

        AuthFormField(
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
                        "Continue",
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
            return Expanded(
              child: Padding(
                padding: EdgeInsets.only(right: index == 5 ? 0 : 6),
                child: Focus(
                  onKeyEvent: (node, event) {
                    _handleOtpKey(index, event);
                    return KeyEventResult.ignored;
                  },
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
                      contentPadding: const EdgeInsets.symmetric(vertical: 16),
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
              ),
            );
          }),
        ),
        SizedBox(height: 16),
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
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _loading || _otpFlow.expired ? null : _submit,
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
                    "Create account",
                    style: GoogleFonts.inter(fontWeight: FontWeight.w800),
                  ),
          ),
        ),
      ],
    );
  }
}
