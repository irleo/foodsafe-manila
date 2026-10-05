import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'package:foodsafe_manila/services/credential_store.dart';
import 'package:foodsafe_manila/services/session_profile.dart';

class Session {
  static Map<String, dynamic>? _currentUser;
  static Map<String, dynamic>? get currentUser => _currentUser;
  static Map<String, dynamic>? userReport;
  static SessionCredentials? _credentials;
  static String? get accessToken => _credentials?.accessToken;
  static String? get refreshToken => _credentials?.refreshToken;
  static int _generation = 0;
  static int get generation => _generation;
  static bool credentialStorageAvailable = false;

  static late SharedPreferences _prefs;
  static Future<void> _pending = Future<void>.value();
  static const _legacyKeys = [
    'access_token',
    'refresh_token',
    'accessToken',
    'refreshToken',
    'password',
    'otp',
    'verificationToken',
    'verification_token',
  ];

  // Serialize credential/cache writes. A logout also invalidates in-flight refreshes.
  static Future<T> _enqueue<T>(Future<T> Function() operation) {
    final result = _pending.then((_) => operation());
    _pending = result.then<void>(
      (_) => null,
      onError: (Object error, StackTrace stack) => null,
    );
    return result;
  }

  static Map<String, dynamic>? _decodeUser(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      return decoded is Map<String, dynamic> ? decoded : null;
    } on FormatException {
      return null;
    }
  }

  static String? _token(Object? value) =>
      value is String && value.isNotEmpty ? value : null;

  static Future<void> _purgeLegacy() async {
    for (final key in _legacyKeys) {
      if (!await _prefs.remove(key)) throw const SessionStorageException();
    }
  }

  static Future<void> _cacheProfile(SessionProfile profile) async {
    if (!await _prefs.setString('current_user', jsonEncode(profile.toJson()))) {
      throw const SessionStorageException();
    }
  }

  static Future<void> initialize() => _enqueue(() async {
    _generation++;
    _currentUser = null;
    _credentials = null;
    userReport = null;
    credentialStorageAvailable = false;
    _prefs = await SharedPreferences.getInstance();
    try {
      final legacyUser = _decodeUser(_prefs.getString('current_user'));
      final profile = SessionProfile.fromJson(legacyUser);
      var credentials = await CredentialStore.read();
      if (credentials == null && profile != null) {
        final access =
            _token(_prefs.get('access_token')) ??
            _token(legacyUser?['accessToken']);
        final refresh =
            _token(_prefs.get('refresh_token')) ??
            _token(legacyUser?['refreshToken']);
        if (access != null) {
          credentials = SessionCredentials(
            userId: profile.userId,
            accessToken: access,
            refreshToken: refresh,
          );
          await CredentialStore.write(credentials);
        }
      }
      if (profile == null ||
          credentials == null ||
          credentials.userId != profile.userId) {
        await CredentialStore.clear();
        if (!await _prefs.remove('current_user')) {
          throw const SessionStorageException();
        }
      } else {
        // Rewrite old login-response JSON even when tokens were already migrated.
        await _cacheProfile(profile);
        _credentials = credentials;
        _currentUser = Map<String, dynamic>.unmodifiable(profile.toJson());
      }
      credentialStorageAvailable = true;
    } catch (error) {
      _credentials = null;
      _currentUser = null;
      try {
        await CredentialStore.clear();
      } catch (storageError) {
        credentialStorageAvailable = false;
      }
      if (!await _prefs.remove('current_user')) {
        throw const SessionStorageException();
      }
      // No fallback to plaintext credentials. A corrupt/unavailable vault opens
      // the app signed out; a later login can retry secure storage.
    } finally {
      await _purgeLegacy();
    }
  });

  static Future<bool> saveTokens({
    required String accessToken,
    required String refreshToken,
    Map<String, dynamic>? user,
    int? expectedGeneration,
  }) {
    final version = expectedGeneration ?? ++_generation;
    return _enqueue(() async {
      if (version != _generation) return false;
      final profile = SessionProfile.fromJson(user ?? _currentUser);
      if (profile == null || accessToken.isEmpty || refreshToken.isEmpty) {
        throw const SessionStorageException();
      }
      final credentials = SessionCredentials(
        userId: profile.userId,
        accessToken: accessToken,
        refreshToken: refreshToken,
      );
      try {
        await CredentialStore.write(credentials);
        if (version != _generation) return false;
        await _cacheProfile(profile);
        await _purgeLegacy();
        if (version != _generation) return false;
        _credentials = credentials;
        _currentUser = Map<String, dynamic>.unmodifiable(
          profile.toJson(includeUnverifiedEmail: true),
        );
        credentialStorageAvailable = true;
        return true;
      } catch (error) {
        _currentUser = null;
        _credentials = null;
        credentialStorageAvailable = false;
        await _clearPersistent();
        throw const SessionStorageException();
      }
    });
  }

  static Future<void> saveCurrentUser(Map<String, dynamic> user) {
    final version = _generation;
    return _enqueue(() async {
      if (version != _generation) return;
      final profile = SessionProfile.fromJson(user);
      if (profile == null || profile.userId != _credentials?.userId) {
        throw const SessionStorageException();
      }
      await _cacheProfile(profile);
      await _purgeLegacy();
      if (version == _generation) {
        _currentUser = Map<String, dynamic>.unmodifiable(
          profile.toJson(includeUnverifiedEmail: true),
        );
      }
    });
  }

  static Future<void> _clearPersistent() async {
    Object? failure;
    try {
      await CredentialStore.clear();
    } catch (error) {
      failure = error;
    }
    try {
      if (!await _prefs.remove('current_user')) {
        throw const SessionStorageException();
      }
      await _purgeLegacy();
    } catch (error) {
      failure ??= error;
    }
    if (failure != null) throw const SessionStorageException();
  }

  static Future<void> clear() {
    _generation++;
    _currentUser = null;
    _credentials = null;
    userReport = null;
    return _enqueue(_clearPersistent);
  }
}
