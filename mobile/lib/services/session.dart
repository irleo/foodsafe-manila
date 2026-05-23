import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class Session {
  static Map<String, dynamic>? currentUser;
  static Map<String, dynamic>? userReport;
  static String? accessToken;
  static String? refreshToken;

  static late SharedPreferences _prefs;

  static Future<void> initialize() async {
    _prefs = await SharedPreferences.getInstance();
    accessToken = _prefs.getString('access_token');
    refreshToken = _prefs.getString('refresh_token');

    final storedUser = _prefs.getString('current_user');
    if (storedUser != null && storedUser.isNotEmpty) {
      try {
        currentUser = jsonDecode(storedUser) as Map<String, dynamic>;
      } catch (_) {
        currentUser = null;
      }
    }
  }

  static Future<void> saveTokens({
    required String accessToken,
    String? refreshToken,
    Map<String, dynamic>? user,
  }) async {
    Session.accessToken = accessToken;
    if (refreshToken != null) {
      Session.refreshToken = refreshToken;
      await _prefs.setString('refresh_token', refreshToken);
    }
    await _prefs.setString('access_token', accessToken);

    if (user != null) {
      await saveCurrentUser(user);
    }
  }

  static Future<void> saveCurrentUser(Map<String, dynamic> user) async {
    currentUser = {
      ...user,
      '_id': user['_id'] ?? user['id'],
      'id': user['id'] ?? user['_id'],
    };
    await _prefs.setString('current_user', jsonEncode(currentUser));
  }

  static Future<void> clear() async {
    currentUser = null;
    accessToken = null;
    refreshToken = null;
    await _prefs.remove('current_user');
    await _prefs.remove('access_token');
    await _prefs.remove('refresh_token');
  }
}
