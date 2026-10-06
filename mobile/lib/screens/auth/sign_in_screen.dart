import 'package:foodsafe_manila/widgets/auth_form_field.dart';
import 'package:flutter/material.dart';
import 'package:foodsafe_manila/screens/auth/change_password_screen.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:foodsafe_manila/widgets/snackbar_widgets.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:foodsafe_manila/services/api_service.dart';
import 'package:foodsafe_manila/services/api_client.dart';
import 'package:foodsafe_manila/utils/philippine_mobile_number.dart';
import 'package:foodsafe_manila/widgets/app_loading.dart';
import 'package:foodsafe_manila/widgets/philippine_mobile_prefix.dart';
import 'package:foodsafe_manila/screens/reporting/report_form_screen.dart';
import 'package:foodsafe_manila/screens/legal/policy_screen.dart';
import 'package:foodsafe_manila/layout/auth_screen_layout.dart';

class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key});

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
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
    if (_loading) return;
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;

    setState(() => _loading = true);

    try {
      final phone = toLocalPhilippineMobileNumber(_phoneCtrl.text);
      final password = _passCtrl.text;

      final user = await ApiService.login(phone, password);

      if (!mounted) return;

      if (user != null) {
        SnackbarWidgets.success(context, "Sign in successful");

        final args =
            ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;

        if (args != null && args['returnToReport'] == true) {
          Navigator.pushReplacementNamed(context, '/dashboard');

          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (!mounted) return;
            Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => const ReportFormScreen()),
            );
          });
          return;
        }

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
    return AuthScreenLayout(
      onBack: () => Navigator.maybePop(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "Welcome Back!",
            style: GoogleFonts.inter(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: Color(0xFF111827),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            "Sign in to continue to FoodSafe",
            style: GoogleFonts.inter(fontSize: 13, color: Color(0xFF4B5563)),
          ),
          const SizedBox(height: 14),

          Form(
            key: _formKey,
            child: Column(
              children: [
                AuthFormField(
                  label: "Phone Number",
                  child: TextFormField(
                    controller: _phoneCtrl,
                    keyboardType: TextInputType.number,
                    textInputAction: TextInputAction.next,
                    inputFormatters: const [PhilippineMobileInputFormatter()],
                    style: GoogleFonts.inter(),
                    decoration: InputDecoration(
                      hintText: philippineMobileHint,
                      hintStyle: GoogleFonts.inter(color: Color(0xFFD1D5DB)),
                      prefixIcon: const PhilippineMobilePrefix(),
                      prefixIconConstraints: const BoxConstraints(minWidth: 88),
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

                AuthFormField(
                  label: "Password",
                  child: TextFormField(
                    controller: _passCtrl,
                    obscureText: !_showPass,
                    textInputAction: TextInputAction.done,
                    onFieldSubmitted: (_) => _signIn(),
                    style: GoogleFonts.inter(),
                    decoration: InputDecoration(
                      hintText: "••••••••",
                      hintStyle: GoogleFonts.inter(color: Color(0xFFD1D5DB)),
                      prefixIcon: const Icon(LucideIcons.lock),
                      suffixIcon: IconButton(
                        onPressed: () => setState(() => _showPass = !_showPass),
                        icon: Icon(
                          _showPass ? LucideIcons.eye : LucideIcons.eyeOff,
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

                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) =>
                              ChangePasswordScreen(isForgot: true),
                        ),
                      );
                    },
                    child: Text(
                      "Forgot Password?",
                      style: GoogleFonts.inter(
                        color: Color(0xFF134c8c),
                        fontWeight: FontWeight.w600,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 8),

                ConstrainedBox(
                  constraints: const BoxConstraints(
                    minHeight: 54,
                    minWidth: double.infinity,
                  ),
                  child: ElevatedButton(
                    onPressed: _loading ? null : _signIn,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF134c8c),
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
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          Center(
            child: Wrap(
              alignment: WrapAlignment.center,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(
                  'New to FoodSafe?',
                  style: GoogleFonts.inter(color: const Color(0xFF4B5563)),
                ),
                TextButton(
                  onPressed: () => Navigator.pushNamed(context, '/signup'),
                  child: Text(
                    'Create account',
                    style: GoogleFonts.inter(
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF134C8C),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          const Center(child: PolicyLinks(compact: true)),
        ],
      ),
    );
  }
}
