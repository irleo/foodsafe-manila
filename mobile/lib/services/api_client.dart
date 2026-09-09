import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/api_config.dart';
import 'session.dart';

class ApiException implements Exception {
  final int statusCode;
  final String message;
  final String? code;
  final String? errorId;

  ApiException(this.statusCode, this.message, {this.code, this.errorId});

  @override
  String toString() => message;
}

class ApiClient {
  static final RegExp _unsafeDetails = RegExp(
    r'traceback|modulenotfounderror|mongodb|mongoose|bson|e11000|enoent|eacces|node_modules|prophet|cmdstan|pystan|pandas|numpy|openpyxl|multer|express|jsonwebtoken|bcrypt|aws-sdk|cloudflare|process\.env|node_env|mongo_uri|python_bin|\.m?js:\d+|\.py:\d+|\.dart:\d+|[a-z]:\\|file://|/(?:app|home|opt|srv|usr|workspace)/|\?[a-z0-9_.%\[\]-]+=|mongodb(?:\+srv)?://|access[_-]?token|refresh[_-]?token|secret|authorization|aws_|r2_',
    caseSensitive: false,
  );

  static const Map<String, String> _safeCodeMessages = {
    'INTERNAL_ERROR': 'The request could not be completed.',
    'DASHBOARD_DATA_ERROR': 'Dashboard data could not be loaded.',
    'DATASET_UPLOAD_ERROR': 'The file could not be processed.',
    'DATASET_SERVICE_ERROR': 'The dataset request could not be completed.',
    'REPORT_SERVICE_ERROR': 'Reports could not be loaded.',
    'HEATMAP_SERVICE_ERROR': 'Heatmap data is currently unavailable.',
    'ANALYTICS_SERVICE_ERROR': 'Analytics data could not be loaded.',
    'PREDICTION_SERVICE_ERROR': 'Prediction data is currently unavailable.',
    'AUTHENTICATION_ERROR': 'The authentication request could not be completed.',
    'AUTHORIZATION_ERROR': 'You do not have access to this action.',
  };

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

    if (auth &&
        (response.statusCode == 401 || response.statusCode == 403) &&
        Session.refreshToken != null) {
      final refreshed = await _refreshAccessToken();
      if (refreshed) {
        response = await request();
        if (response.statusCode == 401 || response.statusCode == 403) {
          await Session.clear();
        }
      } else {
        await Session.clear();
      }
    }

    return response;
  }

  /// Restores a valid access token on cold start (web parity: fresh token before data fetch).
  static Future<void> warmSession() async {
    if (Session.currentUser == null) return;

    final refreshToken = Session.refreshToken;
    if (refreshToken == null || refreshToken.isEmpty) {
      if (Session.accessToken == null || Session.accessToken!.isEmpty) {
        await Session.clear();
      }
      return;
    }

    final ok = await _refreshAccessToken();
    if (!ok) await Session.clear();
  }

  /// Refreshes tokens when the app returns to the foreground.
  static Future<bool> refreshSessionOnResume() async {
    if (Session.currentUser == null) return false;

    final refreshToken = Session.refreshToken;
    if (refreshToken == null || refreshToken.isEmpty) {
      await Session.clear();
      return false;
    }

    final ok = await _refreshAccessToken();
    if (!ok) await Session.clear();
    return ok;
  }

  static bool get hasAuthenticatedSession {
    return Session.currentUser != null &&
        Session.accessToken != null &&
        Session.accessToken!.isNotEmpty;
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
    String? code;
    String? errorId;
    try {
      final data = jsonDecode(response.body);
      if (data is Map) {
        code = data['code']?.toString();
        errorId = data['errorId']?.toString();
        final codedMessage = _safeCodeMessages[code];
        final candidate = data['message']?.toString() ?? '';
        if (codedMessage != null) {
          message = codedMessage;
        } else if (candidate.isNotEmpty &&
            candidate.length <= 500 &&
            !_unsafeDetails.hasMatch(candidate)) {
          message = candidate;
        }
      }
    } catch (_) {
      message = fallback ?? 'Request failed';
    }

    throw ApiException(
      response.statusCode,
      message,
      code: code,
      errorId: errorId,
    );
  }

  static String safeErrorMessage(
    Object error, {
    String fallback = 'The request could not be completed.',
  }) {
    if (error is! ApiException) return fallback;
    final message = error.message.isNotEmpty &&
            error.message.length <= 500 &&
            !_unsafeDetails.hasMatch(error.message)
        ? error.message
        : fallback;
    return error.errorId == null ? message : '$message Reference: ${error.errorId}';
  }
}
