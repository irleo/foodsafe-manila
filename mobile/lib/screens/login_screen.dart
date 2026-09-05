import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../widgets/snackbar_widgets.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';
import '../services/api_client.dart';
import '../services/session.dart';
import '../utils/philippine_mobile_number.dart';
import '../widgets/app_loading.dart';
import '../widgets/philippine_mobile_prefix.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LogInScreenState();
}

class _LogInScreenState extends State<LoginScreen> {
  final _phoneCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  bool _showPass = false;
  bool _loading = false;

  bool backPressedOnce = false;
  DateTime? currentBackPressTime;

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _signIn() async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;

    setState(() => _loading = true);

    try {
      final phone = toLocalPhilippineMobileNumber(_phoneCtrl.text);
      String password = _passCtrl.text;

      var user = await ApiService.login(phone, password);

      if (!mounted) return;

      if (user != null) {
        await Session.saveCurrentUser(user);
        if (!mounted) return;
        SnackbarWidgets.success(context, "Login successful");

        Navigator.pushReplacementNamed(context, '/dashboard');
      } else {
        SnackbarWidgets.error(context, "Invalid phone number or password");
      }
    } catch (error) {
      if (mounted) {
        SnackbarWidgets.error(
          context,
          ApiClient.safeErrorMessage(
            error,
            fallback: 'Unable to sign in. Please try again.',
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
      backgroundColor: Colors.white,
      body: SafeArea(
        top: true,
        child: PopScope(
          canPop: false,
          onPopInvokedWithResult: (didPop, result) async {
            if (didPop) return;

            if (backPressedOnce) {
              await SystemNavigator.pop();
            } else {
              setState(() {
                backPressedOnce = true;
              });

              SnackbarWidgets.error(
                context,
                'If you are trying to exit the app, please try again',
              );

              Future.delayed(const Duration(seconds: 2), () {
                if (mounted) {
                  setState(() {
                    backPressedOnce = false;
                  });
                }
              });
            }
          },
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
                    padding: EdgeInsets.fromLTRB(16, 64, 16, 24),
                    child: Column(
                      children: [Image.asset('assets/foodsafe_logo.png')],
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
                        Text(
                          "Welcome Back",
                          style: GoogleFonts.inter(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF111827),
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          "Sign in to continue",
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            color: Color(0xFF4B5563),
                          ),
                        ),
                        const SizedBox(height: 14),

                        Form(
                          key: _formKey,
                          child: Column(
                            children: [
                              _LabeledField(
                                label: "Phone Number",
                                child: TextFormField(
                                  controller: _phoneCtrl,
                                  keyboardType: TextInputType.number,
                                  textInputAction: TextInputAction.next,
                                  inputFormatters: const [
                                    PhilippineMobileInputFormatter(),
                                  ],
                                  style: GoogleFonts.inter(),
                                  decoration: InputDecoration(
                                    hintText: philippineMobileHint,
                                    hintStyle: GoogleFonts.inter(
                                      color: Color(0xFFD1D5DB),
                                    ),
                                    prefixIcon: const PhilippineMobilePrefix(),
                                    prefixIconConstraints: const BoxConstraints(
                                      minWidth: 88,
                                    ),
                                  ),
                                  validator: validatePhilippineMobileInput,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Align(
                                alignment: Alignment.centerLeft,
                                child: Text(
                                  philippineMobileHelper,
                                  style: GoogleFonts.inter(
                                    fontSize: 11,
                                    color: Color(0xFF6B7280),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 14),

                              _LabeledField(
                                label: "Password",
                                child: TextFormField(
                                  controller: _passCtrl,
                                  obscureText: !_showPass,
                                  textInputAction: TextInputAction.done,
                                  onFieldSubmitted: (_) => _signIn(),
                                  style: GoogleFonts.inter(),
                                  decoration: InputDecoration(
                                    hintText: "Enter password",
                                    hintStyle: GoogleFonts.inter(
                                      color: Color(0xFFD1D5DB),
                                    ),
                                    prefixIcon: const Icon(LucideIcons.lock),
                                    suffixIcon: IconButton(
                                      onPressed: () =>
                                          setState(() => _showPass = !_showPass),
                                      icon: Icon(
                                        _showPass
                                            ? LucideIcons.eye
                                            : LucideIcons.eyeOff,
                                      ),
                                    ),
                                  ),
                                  validator: (v) {
                                    final value = (v ?? "");
                                    if (value.isEmpty) {
                                      return "Password is required.";
                                    }
                                    return null;
                                  },
                                ),
                              ),

                              Row(
                                mainAxisAlignment: MainAxisAlignment.end,
                                children: [
                                  TextButton(
                                    onPressed: () {
                                      Navigator.pushNamed(
                                        context,
                                        '/change_password',
                                      );
                                    },
                                    child: Text(
                                      "Forgot Password?",
                                      style: GoogleFonts.inter(
                                        color: Color(0xFF2563EB),
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                ],
                              ),

                              const SizedBox(height: 6),

                              SizedBox(
                                width: double.infinity,
                                height: 54,
                                child: ElevatedButton(
                                  onPressed: _loading ? null : _signIn,
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFF2563EB),
                                    foregroundColor: Colors.white,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(14),
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
                                          "Sign In",
                                          style: GoogleFonts.inter(
                                            fontSize: 16,
                                            fontWeight: FontWeight.w800,
                                          ),
                                        ),
                                ),
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 18),

                        const Divider(height: 1, color: Color(0xFFE5E7EB)),
                        const SizedBox(height: 14),

                        Text(
                          "Don't have an account?",
                          textAlign: TextAlign.center,
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            color: Color(0xFF4B5563),
                          ),
                        ),
                        const SizedBox(height: 10),

                        SizedBox(
                          width: double.infinity,
                          height: 54,
                          child: OutlinedButton(
                            onPressed: () {
                              Navigator.pushNamed(context, '/signup');
                            },
                            style: OutlinedButton.styleFrom(
                              side: const BorderSide(
                                color: Color(0xFF2563EB),
                                width: 2,
                              ),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                            child: Text(
                              "Create Account",
                              style: GoogleFonts.inter(
                                color: Color(0xFF2563EB),
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ),

                        const SizedBox(height: 18),

                        Text(
                          "By signing in, you agree to our Terms of Service and Privacy Policy. "
                          "Your data is protected under the Data Privacy Act of 2012.",
                          textAlign: TextAlign.center,
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            color: Color(0xFF4B5563),
                            height: 1.35,
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
