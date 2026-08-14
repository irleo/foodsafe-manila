import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'screens/bottom_nav_bar_screen.dart';
import '../screens/login_screen.dart';
import '../screens/signup_screen.dart';
import 'screens/change_password_screen.dart';
import 'services/location_service.dart';
import 'services/notification_service.dart';
import 'services/risk_alert_service.dart';
import 'services/api_client.dart';
import 'services/session.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Session.initialize();
  await ApiClient.warmSession();
  await NotificationService.initialize();
  await LocationService.preloadLocation();
  if (Session.currentUser != null) {
    RiskAlertService.instance.startMonitoring();
  }
  runApp(
    MainApp(
      initialRoute: ApiClient.hasAuthenticatedSession ? '/dashboard' : '/login',
    ),
  );
}

class MainApp extends StatelessWidget {
  final String initialRoute;

  const MainApp({super.key, required this.initialRoute});

  @override
  Widget build(BuildContext context) {
    return ScreenUtilInit(
      builder: (context, child) {
        return MaterialApp(
          debugShowCheckedModeBanner: false,
          initialRoute: initialRoute,
          routes: {
            '/login': (context) => const LoginScreen(),
            '/signup': (context) => const SignupScreen(),
            '/change_password': (context) => const ChangePasswordScreen(),
            '/dashboard': (context) => const BottomNavBarScreen(),
          },
        );
      },
    );
  }
}
