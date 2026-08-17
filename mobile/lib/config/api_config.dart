import 'package:flutter/foundation.dart';

class ApiConfig {
  static const String _configuredBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: '',
  );

  static String get baseUrl {
    final configuredUrl = _configuredBaseUrl.trim();

    if (configuredUrl.isNotEmpty) {
      final normalizedUrl = configuredUrl.replaceFirst(RegExp(r'/+$'), '');
      final uri = Uri.tryParse(normalizedUrl);

      if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
        throw StateError('API_BASE_URL is invalid.');
      }

      return normalizedUrl;
    }

    if (kReleaseMode) {
      throw StateError('API_BASE_URL is required for release builds.');
    }

    // Android Emulator
    return 'http://10.0.2.2:5000/api';
  }
}