import 'dart:async';
import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:foodsafe_manila/services/api_client.dart';
import 'package:foodsafe_manila/services/api_service.dart';
import 'package:foodsafe_manila/services/session.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
    await Session.initialize();
  });
  tearDown(() async => Session.clear());

  test(
    'incorrect credentials return a credential failure without a session',
    () async {
      final user = await http.runWithClient(
        () => ApiService.login('09171234567', 'incorrect'),
        () => MockClient(
          (_) async => http.Response('{"message":"Invalid credentials"}', 401),
        ),
      );
      expect(user, isNull);
      expect(Session.currentUser, isNull);
    },
  );

  for (final status in [429, 500, 503]) {
    test(
      'HTTP $status is a service error rather than incorrect credentials',
      () async {
        await expectLater(
          http.runWithClient(
            () => ApiService.login('09171234567', 'test-password'),
            () => MockClient((_) async => http.Response('{}', status)),
          ),
          throwsA(
            isA<ApiException>().having(
              (error) => error.statusCode,
              'status',
              status,
            ),
          ),
        );
        expect(Session.currentUser, isNull);
      },
    );
  }

  test(
    'successful HTTP response missing credentials is a response error',
    () async {
      await expectLater(
        http.runWithClient(
          () => ApiService.login('09171234567', 'test-password'),
          () => MockClient(
            (_) async => http.Response('{"_id":"citizen-1"}', 200),
          ),
        ),
        throwsA(
          isA<ApiException>().having(
            (error) => error.statusCode,
            'status',
            502,
          ),
        ),
      );
      expect(Session.currentUser, isNull);
    },
  );

  test('connection failure provides actionable feedback', () async {
    await http.runWithClient(
      () async {
        try {
          await ApiService.login('09171234567', 'test-password');
          fail('Connection failure should propagate');
        } catch (error) {
          expect(
            ApiClient.safeErrorMessage(error),
            contains('Check your connection'),
          );
        }
      },
      () => MockClient(
        (_) async => throw http.ClientException('private connection details'),
      ),
    );
    expect(Session.currentUser, isNull);
  });

  testWidgets('stalled login times out and a late response cannot sign in', (
    tester,
  ) async {
    final reply = Completer<http.Response>();
    final timedOut = expectLater(
      http.runWithClient(
        () => ApiService.login('09171234567', 'test-password'),
        () => MockClient((_) => reply.future),
      ),
      throwsA(isA<TimeoutException>()),
    );
    await tester.pump();
    await tester.pump(const Duration(seconds: 30));
    await timedOut;
    expect(Session.currentUser, isNull);
    expect(
      ApiClient.safeErrorMessage(TimeoutException('private details')),
      contains('too long'),
    );

    reply.complete(
      http.Response(
        jsonEncode({
          '_id': 'citizen-1',
          'username': 'Tester',
          'phoneNumber': '09171234567',
          'accessToken': 'late-access',
          'refreshToken': 'late-refresh',
        }),
        200,
      ),
    );
    await tester.pump();
    expect(Session.currentUser, isNull);
    expect(Session.accessToken, isNull);
  });
}
