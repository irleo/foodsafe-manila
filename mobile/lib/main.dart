import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:foodsafe_manila/layout/dashboard_layout.dart';
import 'package:foodsafe_manila/screens/auth/sign_in_screen.dart';
import 'package:foodsafe_manila/screens/auth/sign_up_screen.dart';
import 'package:foodsafe_manila/screens/auth/change_password_screen.dart';
import 'package:foodsafe_manila/services/api_client.dart';
import 'package:foodsafe_manila/services/session.dart';
import 'package:foodsafe_manila/screens/legal/policy_screen.dart';

final appNavigatorKey = GlobalKey<NavigatorState>();

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const _StartupApp());
}

/// Show progress while restoring credentials before protected screens can load.
class _StartupApp extends StatefulWidget {
  const _StartupApp();

  @override
  State<_StartupApp> createState() => _StartupAppState();
}

class _StartupAppState extends State<_StartupApp> {
  late Future<void> _initialization;

  @override
  void initState() {
    super.initState();
    _initialization = _initialize();
  }

  Future<void> _initialize() async {
    try {
      await Session.initialize();
      await ApiClient.warmSession();
    } catch (error, stack) {
      Error.throwWithStackTrace(error, stack);
    }
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<void>(
    future: _initialization,
    builder: (context, snapshot) {
      if (snapshot.connectionState == ConnectionState.done &&
          !snapshot.hasError) {
        return const MainApp();
      }
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        home: Scaffold(
          backgroundColor: const Color(0xFF134C8C),
          body: SafeArea(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'FoodSafe Manila',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 24),
                    if (snapshot.hasError) ...[
                      const Text(
                        'Could not restore your session. Please try again.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.white),
                      ),
                      const SizedBox(height: 16),
                      FilledButton(
                        onPressed: () =>
                            setState(() => _initialization = _initialize()),
                        child: const Text('Retry'),
                      ),
                    ] else ...[
                      const CircularProgressIndicator(color: Colors.white),
                      const SizedBox(height: 16),
                      const Text(
                        'Restoring your session…',
                        style: TextStyle(color: Colors.white70),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    },
  );
}

class MainApp extends StatelessWidget {
  const MainApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ScreenUtilInit(
      builder: (context, child) {
        return MaterialApp(
          navigatorKey: appNavigatorKey,
          debugShowCheckedModeBanner: false,
          initialRoute: '/dashboard',
          routes: {
            '/login': (context) => const SignInScreen(),
            '/signup': (context) => const SignUpScreen(),
            '/change_password': (context) => const ChangePasswordScreen(),
            '/dashboard': (context) => const DashboardLayout(),
            '/policies': (context) => const PolicyScreen(),
          },
        );
      },
    );
  }
}
