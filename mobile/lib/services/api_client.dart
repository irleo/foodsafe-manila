import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/api_config.dart';
import 'session.dart';

class ApiException implements Exception {
  final int statusCode;
  final String message;

  ApiException(this.statusCode, this.message);

  @override
  String toString() => message;
}

class ApiClient {
  static const Map<String, String> jsonHeaders = {
    'Content-Type': 'application/json',
  };

  static Map<String, String> _authHeaders() {
    final token = Session.accessToken;
    return {
      ...jsonHeaders,
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
    };
  }

  static Future<http.Response> get(
    String path, {
    Map<String, String>? query,
    bool auth = true,
  }) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}$path').replace(
      queryParameters: query?.isNotEmpty == true ? query : null,
    );
    return _send(() => http.get(uri, headers: auth ? _authHeaders() : jsonHeaders));
  }

  static Future<http.Response> post(
    String path, {
    Object? body,
    bool auth = true,
  }) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}$path');
    return _send(
      () => http.post(
        uri,
        headers: auth ? _authHeaders() : jsonHeaders,
        body: body == null ? null : jsonEncode(body),
      ),
      auth: auth,
    );
  }

  static Future<http.Response> put(
    String path, {
    Object? body,
    bool auth = true,
  }) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}$path');
    return _send(
      () => http.put(
        uri,
        headers: auth ? _authHeaders() : jsonHeaders,
        body: body == null ? null : jsonEncode(body),
      ),
      auth: auth,
    );
  }

  static Future<http.Response> _send(
    Future<http.Response> Function() request, {
    bool auth = true,
  }) async {
    var response = await request();

    if (auth && response.statusCode == 401 && Session.refreshToken != null) {
      final refreshed = await _refreshAccessToken();
      if (refreshed) {
        response = await request();
      }
    }

    return response;
  }

  /// Restores an expired access token on cold start when a refresh token exists.
  static Future<void> warmSession() async {
    if (Session.currentUser == null) return;
    if (Session.accessToken != null && Session.accessToken!.isNotEmpty) return;
    if (Session.refreshToken == null) {
      await Session.clear();
      return;
    }
    final ok = await _refreshAccessToken();
    if (!ok) await Session.clear();
  }

  static Future<bool> _refreshAccessToken() async {
    final refreshToken = Session.refreshToken;
    if (refreshToken == null || refreshToken.isEmpty) return false;

    try {
      final uri = Uri.parse('${ApiConfig.baseUrl}/auth/mobile/refresh');
      final response = await http.post(
        uri,
        headers: jsonHeaders,
        body: jsonEncode({'refreshToken': refreshToken}),
      );

      if (response.statusCode != 200) return false;

      final data = jsonDecode(response.body) as Map<String, dynamic>;
      final accessToken = data['accessToken'] as String?;
      final newRefresh = data['refreshToken'] as String?;
      final user = data['user'] as Map<String, dynamic>?;

      if (accessToken == null) return false;

      await Session.saveTokens(
        accessToken: accessToken,
        refreshToken: newRefresh ?? refreshToken,
        user: user,
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  static Map<String, dynamic> decodeMap(http.Response response) {
    final body = jsonDecode(response.body);
    if (body is Map<String, dynamic>) return body;
    throw ApiException(response.statusCode, 'Invalid response format');
  }

  static List<Map<String, dynamic>> decodeList(http.Response response) {
    final body = jsonDecode(response.body);
    if (body is List) {
      return body.cast<Map<String, dynamic>>();
    }
    throw ApiException(response.statusCode, 'Invalid response format');
  }

  static void throwIfError(http.Response response, {String? fallback}) {
    if (response.statusCode >= 200 && response.statusCode < 300) return;

    String message = fallback ?? 'Request failed';
    try {
      final data = jsonDecode(response.body);
      if (data is Map && data['message'] != null) {
        message = data['message'].toString();
      }
    } catch (_) {}

    throw ApiException(response.statusCode, message);
  }
}
