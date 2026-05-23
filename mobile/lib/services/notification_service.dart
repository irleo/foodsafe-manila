import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class NotificationService {
  static final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();
  static bool _initialized = false;

  static Future<void> initialize() async {
    if (_initialized) return;

    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const settings = InitializationSettings(android: android);
    await _plugin.initialize(settings);
    _initialized = true;
  }

  static Future<void> showHighRiskAlert({
    required int id,
    required String title,
    required String body,
  }) async {
    if (!_initialized) await initialize();

    const details = NotificationDetails(
      android: AndroidNotificationDetails(
        'high_risk_channel',
        'High Risk Alerts',
        channelDescription: 'Alerts when entering high-risk areas in Manila',
        importance: Importance.high,
        priority: Priority.high,
      ),
    );

    await _plugin.show(id, title, body, details);
  }
}
