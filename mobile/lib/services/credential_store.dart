import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SessionStorageException implements Exception {
  const SessionStorageException();
  String get message =>
      'Secure session storage is unavailable. Please try again.';
}

class SessionCredentials {
  final String userId;
  final String accessToken;
  final String? refreshToken;

  const SessionCredentials({
    required this.userId,
    required this.accessToken,
    this.refreshToken,
  });

  factory SessionCredentials.fromJson(Map<String, dynamic> json) {
    final id = json['userId'];
    final access = json['accessToken'];
    final refresh = json['refreshToken'];
    if (id is! String ||
        id.isEmpty ||
        access is! String ||
        access.isEmpty ||
        (refresh != null && (refresh is! String || refresh.isEmpty))) {
      throw const FormatException('Invalid credential record');
    }
    return SessionCredentials(
      userId: id,
      accessToken: access,
      refreshToken: refresh as String?,
    );
  }

  Map<String, Object?> toJson() => {
    'userId': userId,
    'accessToken': accessToken,
    'refreshToken': refreshToken,
  };
}

class CredentialStore {
  static const key = 'session_credentials_v1';
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(),
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.unlocked_this_device,
    ),
  );

  static Future<SessionCredentials?> read() async {
    final raw = await _storage.read(key: key);
    if (raw == null) return null;
    return SessionCredentials.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  static Future<void> write(SessionCredentials credentials) async {
    // One secure record keeps a rotated access/refresh pair together.
    final encoded = jsonEncode(credentials.toJson());
    await _storage.write(key: key, value: encoded);
    if (await _storage.read(key: key) != encoded) {
      throw const SessionStorageException();
    }
  }

  static Future<void> clear() => _storage.delete(key: key);
}
