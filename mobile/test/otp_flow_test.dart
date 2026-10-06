import 'package:flutter_test/flutter_test.dart';
import 'package:foodsafe_manila/services/api_client.dart';
import 'package:foodsafe_manila/services/otp_flow.dart';

void main() {
  late DateTime now;
  late OtpFlow flow;
  setUp(() {
    now = DateTime.utc(2026);
    flow = OtpFlow(clock: () => now);
  });
  tearDown(() => flow.dispose());
  test('server deadlines account for elapsed time while app is suspended', () {
    flow.sent(
      OtpSendResult.fromJson({
        'retryAfterSeconds': 37,
        'expiresInSeconds': 120,
      }),
    );
    expect(flow.retryAfterSeconds, 37);
    now = now.add(const Duration(seconds: 38));
    expect(flow.retryAfterSeconds, 0);
    expect(flow.expired, isFalse);
    now = now.add(const Duration(seconds: 83));
    expect(flow.expired, isTrue);
  });
  test(
    'proof survives retry failures but expires at the backend proof deadline',
    () {
      flow.sent(
        OtpSendResult.fromJson({'expiresInSeconds': 5, 'retryAfterSeconds': 0}),
      );
      flow.verified(
        OtpVerificationResult.fromJson({
          'verificationToken': 'proof',
          'expiresInSeconds': 10,
        }),
      );
      now = now.add(const Duration(seconds: 6));
      expect(flow.verificationToken, 'proof');
      expect(flow.expired, isFalse);
      flow.cooldown(37);
      expect(flow.verificationToken, 'proof');
      now = now.add(const Duration(seconds: 5));
      expect(flow.verificationToken, isNull);
      expect(flow.expired, isTrue);
    },
  );
  test(
    'resend invalidates prior proof; rejected proof requires a new code',
    () {
      flow.sent(OtpSendResult.fromJson({}));
      flow.verified(
        OtpVerificationResult.fromJson({'verificationToken': 'proof'}),
      );
      flow.invalidate();
      expect(flow.expired, isTrue);
      expect(flow.retryAfterSeconds, 60);
      flow.sent(OtpSendResult.fromJson({'retryAfterSeconds': 60}));
      expect(flow.expired, isFalse);
      expect(flow.verificationToken, isNull);
      flow.clear();
      expect(flow.retryAfterSeconds, 0);
    },
  );
  test('malformed timing and absent proof do not become valid flow state', () {
    for (final value in ['37', -1, 1.5, double.infinity]) {
      expect(
        () => OtpSendResult.fromJson({'retryAfterSeconds': value}),
        throwsA(isA<ApiException>()),
      );
    }
    expect(
      () => OtpVerificationResult.fromJson({}),
      throwsA(isA<ApiException>()),
    );
  });
}
