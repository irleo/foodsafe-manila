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
