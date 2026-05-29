import 'package:shared_preferences/shared_preferences.dart';

/// Persists which heatmap-based alerts the user has marked as read.
class AlertsReadStore {
  AlertsReadStore._();

  static const _prefix = 'alert_read_';

  static Future<Set<String>> loadReadIds() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs
        .getKeys()
        .where((k) => k.startsWith(_prefix))
        .where((k) => prefs.getBool(k) == true)
        .map((k) => k.substring(_prefix.length))
        .toSet();
  }

  static Future<void> markRead(String id) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('$_prefix$id', true);
  }

  static Future<void> markAllRead(Iterable<String> ids) async {
    final prefs = await SharedPreferences.getInstance();
    for (final id in ids) {
      await prefs.setBool('$_prefix$id', true);
    }
  }
}
