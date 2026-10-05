import 'dart:async';
import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:foodsafe_manila/services/api_client.dart';
import 'package:foodsafe_manila/services/api_service.dart';
import 'package:foodsafe_manila/services/credential_store.dart';
import 'package:foodsafe_manila/services/session.dart';

const profile = {
  '_id': 'citizen-1',
  'username': 'Tester',
  'phoneNumber': '09171234567',
  'email': 'verified@example.com',
  'emailVerified': true,
};
const poisoned = {
  ...profile,
  'accessToken': 'old-access',
  'refreshToken': 'old-refresh',
  'password': 'password-must-not-persist',
  'currentPassword': 'current-password-must-not-persist',
  'otp': '123456',
  'verificationToken': 'proof-must-not-persist',
  'nested': {'refreshToken': 'nested-secret'},
};

Future<Map<String, dynamic>?> vault() async {
  final raw = await const FlutterSecureStorage().read(key: CredentialStore.key);
  return raw == null ? null : jsonDecode(raw) as Map<String, dynamic>;
}

Future<Map<String, dynamic>?> cachedProfile() async {
  final prefs = await SharedPreferences.getInstance();
  final raw = prefs.getString('current_user');
  return raw == null ? null : jsonDecode(raw) as Map<String, dynamic>;
}

Future<void> assertNoLegacySecrets() async {
  final prefs = await SharedPreferences.getInstance();
  for (final key in [
    'access_token',
    'refresh_token',
    'accessToken',
    'refreshToken',
    'password',
    'otp',
    'verificationToken',
    'verification_token',
  ]) {
    expect(
      prefs.containsKey(key),
      isFalse,
      reason: '$key must not be in preferences',
    );
  }
  final cached = await cachedProfile();
  if (cached != null) {
    expect(cached.keys.toSet(), {
      '_id',
      'id',
      'username',
      'phoneNumber',
      'email',
      'emailVerified',
    });
    for (final field in [
      'accessToken',
      'refreshToken',
      'password',
      'currentPassword',
      'otp',
      'verificationToken',
      'nested',
    ]) {
      expect(cached.containsKey(field), isFalse);
      expect(Session.currentUser!.containsKey(field), isFalse);
    }
  }
}

Future<void> signedIn() => Session.saveTokens(
  accessToken: 'old-access',
  refreshToken: 'old-refresh',
  user: poisoned,
).then((_) {});

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
    await Session.initialize();
  });
  tearDown(() async => Session.clear());

  test(
    'login keeps tokens only in secure storage and whitelists the API response',
    () async {
      await http.runWithClient(
        () async {
          final user = await ApiService.login('09171234567', 'test-password');
          expect(user?['_id'], 'citizen-1');
        },
        () => MockClient((request) async {
          expect(request.url.path, '/api/auth/login');
          return http.Response(jsonEncode(poisoned), 200);
        }),
      );
      expect((await vault())?['accessToken'], 'old-access');
      expect((await vault())?['refreshToken'], 'old-refresh');
      await assertNoLegacySecrets();
      await Session.initialize();
      expect(Session.accessToken, 'old-access');
      expect(Session.refreshToken, 'old-refresh');
      expect(Session.currentUser?['username'], 'Tester');
    },
  );

  test(
    'migrates legacy preference keys and token-containing user JSON once',
    () async {
      SharedPreferences.setMockInitialValues({
        'access_token': 'old-access',
        'refresh_token': 'old-refresh',
        'current_user': jsonEncode(poisoned),
        'otp': '123456',
      });
      await Session.initialize();
      expect((await vault())?['userId'], 'citizen-1');
      expect(Session.refreshToken, 'old-refresh');
      await assertNoLegacySecrets();
      await Session.initialize();
      expect(Session.accessToken, 'old-access');
      await assertNoLegacySecrets();
    },
  );

  test('migrates tokens present only inside the old login response', () async {
    SharedPreferences.setMockInitialValues({
      'current_user': jsonEncode(poisoned),
    });
    await Session.initialize();
    expect(Session.accessToken, 'old-access');
    expect(Session.refreshToken, 'old-refresh');
    await assertNoLegacySecrets();
  });

  test(
    'existing secure credentials take priority over stale plaintext copies',
    () async {
      SharedPreferences.setMockInitialValues({
        'current_user': jsonEncode(poisoned),
        'access_token': 'obsolete-access',
        'refresh_token': 'obsolete-refresh',
      });
      FlutterSecureStorage.setMockInitialValues({
        CredentialStore.key: jsonEncode({
          'userId': 'citizen-1',
          'accessToken': 'secure-access',
          'refreshToken': 'secure-refresh',
        }),
      });
      await Session.initialize();
      expect(Session.accessToken, 'secure-access');
      expect(Session.refreshToken, 'secure-refresh');
      await assertNoLegacySecrets();
    },
  );

  test('profile updates cannot sneak secrets into the cache', () async {
    await signedIn();
    await Session.saveCurrentUser({...poisoned, 'username': 'Updated'});
    expect(Session.currentUser?['username'], 'Updated');
    expect((await vault())?['accessToken'], 'old-access');
    await assertNoLegacySecrets();
  });

  test(
    'unverified email remains in memory but is not persisted as profile data',
    () async {
      await Session.saveTokens(
        accessToken: 'access',
        refreshToken: 'refresh',
        user: {
          ...profile,
          'email': 'pending@example.com',
          'emailVerified': false,
        },
      );
      expect(Session.currentUser?['email'], 'pending@example.com');
      expect((await cachedProfile())?['email'], '');
    },
  );

  test(
    'refresh rotates both secure tokens and filters nested response data',
    () async {
      await signedIn();
      await http.runWithClient(
        () async {
          expect(await ApiClient.refreshSessionOnResume(), isTrue);
        },
        () => MockClient((request) async {
          expect(jsonDecode(request.body)['refreshToken'], 'old-refresh');
          return http.Response(
            jsonEncode({
              'accessToken': 'new-access',
              'refreshToken': 'new-refresh',
              'user': {...poisoned, 'username': 'Refreshed'},
            }),
            200,
          );
        }),
      );
      expect(Session.accessToken, 'new-access');
      expect((await vault())?['refreshToken'], 'new-refresh');
      expect(Session.currentUser?['username'], 'Refreshed');
      await assertNoLegacySecrets();
    },
  );

  test('expired refresh clears secure credentials and profile data', () async {
    await signedIn();
    await http.runWithClient(
      () => ApiClient.warmSession(),
      () => MockClient((_) async => http.Response('{}', 403)),
    );
    expect(Session.currentUser, isNull);
    expect(Session.accessToken, isNull);
    expect(Session.refreshToken, isNull);
    expect(await vault(), isNull);
    expect(await cachedProfile(), isNull);
  });

  test(
    'legacy access-only sessions cannot remain signed in on cold start',
    () async {
      SharedPreferences.setMockInitialValues({
        'current_user': jsonEncode(profile),
        'access_token': 'expired-access',
      });
      await Session.initialize();
      await ApiClient.warmSession();
      expect(Session.currentUser, isNull);
      expect(await vault(), isNull);
      await assertNoLegacySecrets();
    },
  );

  test(
    'logout clears both stores and in-memory report state but retains ordinary preferences',
    () async {
      await signedIn();
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('policy_location_enabled', false);
      Session.userReport = {'report': 'in-memory-only'};
      await Session.clear();
      expect(Session.userReport, isNull);
      expect(Session.currentUser, isNull);
      expect(await vault(), isNull);
      expect(await cachedProfile(), isNull);
      expect(prefs.getBool('policy_location_enabled'), isFalse);
      await Session.initialize();
      expect(Session.currentUser, isNull);
    },
  );

  test('late refresh response cannot undo logout', () async {
    await signedIn();
    final reply = Completer<http.Response>();
    await http.runWithClient(() async {
      final refresh = ApiClient.refreshSessionOnResume();
      await Future<void>.delayed(Duration.zero);
      await Session.clear();
      reply.complete(
        http.Response(
          jsonEncode({
            'accessToken': 'late-access',
            'refreshToken': 'late-refresh',
            'user': profile,
          }),
          200,
        ),
      );
      expect(await refresh, isFalse);
    }, () => MockClient((_) => reply.future));
    expect(await vault(), isNull);
    expect(Session.currentUser, isNull);
  });

  test('failed old refresh cannot clear a newer login', () async {
    await signedIn();
    final reply = Completer<http.Response>();
    await http.runWithClient(() async {
      final oldRefresh = ApiClient.refreshSessionOnResume();
      await Future<void>.delayed(Duration.zero);
      await Session.saveTokens(
        accessToken: 'new-login-access',
        refreshToken: 'new-login-refresh',
        user: profile,
      );
      reply.complete(http.Response('{}', 401));
      expect(await oldRefresh, isFalse);
    }, () => MockClient((_) => reply.future));
    expect(Session.accessToken, 'new-login-access');
    expect((await vault())?['refreshToken'], 'new-login-refresh');
  });

  test('concurrent refreshes share one request', () async {
    await signedIn();
    final reply = Completer<http.Response>();
    int calls = 0;
    await http.runWithClient(
      () async {
        final refreshes = Future.wait([
          ApiClient.refreshSessionOnResume(),
          ApiClient.refreshSessionOnResume(),
        ]);
        await Future<void>.delayed(Duration.zero);
        reply.complete(
          http.Response(
            jsonEncode({
              'accessToken': 'new',
              'refreshToken': 'rotated',
              'user': profile,
            }),
            200,
          ),
        );
        expect(await refreshes, [true, true]);
      },
      () => MockClient((_) {
        calls++;
        return reply.future;
      }),
    );
    expect(calls, 1);
  });

  test('permission-denied responses do not delete a valid session', () async {
    await signedIn();
    await http.runWithClient(() async {
      expect((await ApiClient.get('/restricted')).statusCode, 403);
    }, () => MockClient((_) async => http.Response('{}', 403)));
    expect(Session.accessToken, 'old-access');
    expect(await vault(), isNotNull);
  });

  test(
    'expired access retries with refreshed credentials then clears on another 401',
    () async {
      await signedIn();
      var calls = 0;
      await http.runWithClient(
        () async {
          expect((await ApiClient.get('/protected')).statusCode, 401);
        },
        () => MockClient((request) async {
          if (request.url.path.endsWith('/mobile/refresh')) {
            return http.Response(
              jsonEncode({
                'accessToken': 'new-access',
                'refreshToken': 'new-refresh',
                'user': profile,
              }),
              200,
            );
          }
          calls++;
          expect(
            request.headers['Authorization'],
            calls == 1 ? 'Bearer old-access' : 'Bearer new-access',
          );
          return http.Response('{}', 401);
        }),
      );
      expect(calls, 2);
      expect(await vault(), isNull);
      expect(await cachedProfile(), isNull);
    },
  );

  test('corrupt cached identity never exposes orphaned credentials', () async {
    SharedPreferences.setMockInitialValues({
      'current_user': 'not-json',
      'access_token': 'orphan',
    });
    await Session.initialize();
    expect(Session.currentUser, isNull);
    expect(await vault(), isNull);
    await assertNoLegacySecrets();
  });

  test(
    'corrupt secure data fails closed without resurrecting plaintext credentials',
    () async {
      SharedPreferences.setMockInitialValues({
        'current_user': jsonEncode(poisoned),
        'access_token': 'old-access',
      });
      FlutterSecureStorage.setMockInitialValues({
        CredentialStore.key: 'not-json',
      });
      await Session.initialize();
      expect(Session.currentUser, isNull);
      expect(Session.accessToken, isNull);
      expect(await vault(), isNull);
      await assertNoLegacySecrets();
    },
  );
}
