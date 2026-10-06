import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:foodsafe_manila/services/api_client.dart';
import 'package:foodsafe_manila/services/api_service.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

class ClosingClient extends MockClient {
  bool closed = false;
  ClosingClient(super.fn);
  @override
  void close() {
    closed = true;
    super.close();
  }
}

void main() {
  test('specific API messages survive module-code mapping', () {
    for (final entry in <String, String>{
      'USER_SERVICE_ERROR':
          "We couldn't save your account changes. Please try again.",
      'AUTHENTICATION_ERROR': 'Your current password is incorrect.',
      'REPORT_SERVICE_ERROR':
          "We couldn't save your report. Check your report history before trying again.",
      'RECOVERY_EMAIL_SETUP_REQUIRED':
          'Recovery email changes are temporarily unavailable. Please try again later.',
    }.entries) {
      final response = http.Response(
        '{"code":"${entry.key}","message":"${entry.value}","errorId":"ERR-2C3B248C"}',
        503,
      );
      try {
        ApiClient.throwIfError(response);
        fail('Expected an API failure');
      } on ApiException catch (error) {
        expect(error.message, entry.value);
        expect(
          ApiClient.safeErrorMessage(error),
          '${entry.value} Reference: ERR-2C3B248C',
        );
      }
    }
  });

  test('OTP and password validation messages retain their next steps', () {
    for (final message in [
      'Your current password is incorrect.',
      'This code is incorrect or has expired. Check the code or request a new one.',
      'Wait 37 seconds before requesting another code.',
    ]) {
      expect(
        () => ApiClient.throwIfError(
          http.Response('{"message":"$message"}', 400),
        ),
        throwsA(
          isA<ApiException>().having((e) => e.message, 'message', message),
        ),
      );
    }
  });

  test(
    'HTML outages and technical errors use action-specific mobile fallbacks',
    () async {
      await http.runWithClient(
        () async {
          for (final entry in <String, Future<Object?> Function()>{
            'save your account changes': () => ApiService.updateUser(
              id: 'citizen',
              username: 'Juan',
              phone: '09123456789',
            ),
            'create your account': () => ApiService.registerUser(
              username: 'Juan',
              phone: '09123456789',
              password: 'test',
              verificationToken: 'test',
              policyAcceptance: {},
            ),
            'send a verification code': () => ApiService.sendMobileOtp(
              phone: '09123456789',
              purpose: 'registration',
            ),
            'check your verification code': () => ApiService.verifyMobileOtp(
              phone: '09123456789',
              purpose: 'registration',
              otp: '123456',
            ),
            'change your password': () => ApiService.updatePassword(
              phone: '09123456789',
              newPassword: 'test',
              verificationToken: 'test',
            ),
          }.entries) {
            await expectLater(
              entry.value(),
              throwsA(
                isA<ApiException>()
                    .having((e) => e.message, 'action', contains(entry.key))
                    .having(
                      (e) => e.message,
                      'no technical details',
                      isNot(contains('mongoose')),
                    ),
              ),
            );
          }
        },
        () =>
            MockClient((_) async => http.Response('<html>outage</html>', 503)),
      );
    },
  );

  test('rate limits and invalid references do not become generic failures', () {
    expect(
      () => ApiClient.throwIfError(
        http.Response('<html>busy</html>', 429, headers: {'retry-after': '37'}),
      ),
      throwsA(
        isA<ApiException>()
            .having(
              (e) => e.message,
              'guidance',
              contains('wait before trying'),
            )
            .having((e) => e.retryAfterSeconds, 'retry timing', 37),
      ),
    );
    expect(
      ApiClient.safeErrorMessage(
        ApiException(
          500,
          'Please try again.',
          errorId: 'private/internal/path',
        ),
      ),
      'Please try again.',
    );
  });

  test('legacy generic API messages defer to the action-specific fallback', () {
    expect(
      () => ApiClient.throwIfError(
        http.Response(
          '{"code":"USER_SERVICE_ERROR","message":"User data could not be loaded."}',
          500,
        ),
        fallback: "We couldn't save your account changes. Please try again.",
      ),
      throwsA(
        isA<ApiException>().having(
          (e) => e.message,
          'save guidance',
          "We couldn't save your account changes. Please try again.",
        ),
      ),
    );
  });

  test('non-text API messages cannot become user-visible object dumps', () {
    expect(
      () => ApiClient.throwIfError(
        http.Response('{"message":{"internal":"detail"},"code":42}', 500),
        fallback: 'Please retry saving your profile.',
      ),
      throwsA(
        isA<ApiException>().having(
          (e) => e.message,
          'safe fallback',
          'Please retry saving your profile.',
        ),
      ),
    );
  });

  test(
    'API failures preserve status, code and retry header instead of empty data',
    () async {
      await http.runWithClient(
        () async {
          for (final call in <Future<Object?> Function()>[
            () => ApiService.getUserReports('citizen'),
            () => ApiService.getLastReportTime('citizen'),
            ApiService.getDashboard,
            () => ApiService.getOfficialAnalytics(),
            () => ApiService.getRiskHeatmap(),
            ApiService.fetchLatestValidatedDataset,
            () => ApiService.fetchOfficialCasesByDataset('dataset'),
            () => ApiService.fetchDistrictHeatmap(datasetId: 'dataset'),
            () => ApiService.getNearbyRisk(),
          ]) {
            await expectLater(
              call(),
              throwsA(
                isA<ApiException>()
                    .having((e) => e.statusCode, 'status', 429)
                    .having((e) => e.code, 'code', 'RATE_LIMITED')
                    .having((e) => e.retryAfterSeconds, 'retry', 37),
              ),
            );
          }
        },
        () => MockClient(
          (_) async => http.Response(
            '{"code":"RATE_LIMITED"}',
            429,
            headers: {'retry-after': '37'},
          ),
        ),
      );
    },
  );

  test(
    'only explicit null last-report timestamp and empty items mean no reports',
    () async {
      await http.runWithClient(
        () async {
          expect(await ApiService.getLastReportTime('citizen'), isNull);
          expect(
            (await ApiService.getUserReports('citizen'))['items'],
            isEmpty,
          );
        },
        () => MockClient(
          (req) async => http.Response(
            req.url.path.endsWith('/last')
                ? '{"lastReportAt":null}'
                : '{"items":[],"pagination":{"total":0}}',
            200,
          ),
        ),
      );
      for (final body in [
        '{}',
        '{"lastReportAt":"broken-date"}',
        '<html>outage</html>',
      ]) {
        await http.runWithClient(
          () => expectLater(
            ApiService.getLastReportTime('citizen'),
            throwsA(
              isA<ApiException>().having(
                (e) => e.code,
                'code',
                'INVALID_RESPONSE',
              ),
            ),
          ),
          () => MockClient((_) async => http.Response(body, 200)),
        );
      }
      for (final body in ['{}', '{"items":[7]}', '[]']) {
        await http.runWithClient(
          () => expectLater(
            ApiService.getUserReports('citizen'),
            throwsA(isA<ApiException>()),
          ),
          () => MockClient((_) async => http.Response(body, 200)),
        );
      }
    },
  );

  for (final method in ['GET', 'POST', 'PUT']) {
    test(
      '$method timeout closes the client and propagates a retryable failure',
      () async {
        final response = Completer<http.Response>();
        final client = ClosingClient((_) => response.future);
        await http.runWithClient(() async {
          const timeout = Duration(milliseconds: 5);
          final request = switch (method) {
            'GET' => ApiClient.get('/slow', auth: false, timeout: timeout),
            'POST' => ApiClient.post('/slow', auth: false, timeout: timeout),
            _ => ApiClient.put('/slow', auth: false, timeout: timeout),
          };
          await expectLater(request, throwsA(isA<TimeoutException>()));
          expect(client.closed, isTrue);
          response.complete(http.Response('{}', 200));
        }, () => client);
      },
    );
  }
  test('malformed JSON and mixed lists produce safe structured failures', () {
    for (final body in ['not json', '[]']) {
      expect(
        () => ApiClient.decodeMap(http.Response(body, 200)),
        throwsA(isA<ApiException>()),
      );
    }
    expect(
      () => ApiClient.decodeList(http.Response('[{},7]', 200)),
      throwsA(isA<ApiException>()),
    );
  });
}
