import 'package:flutter_test/flutter_test.dart';
import 'package:foodsafe_manila/utils/recovery_email.dart';
import 'package:foodsafe_manila/services/api_service.dart';
import 'package:foodsafe_manila/services/api_client.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  test(
    'email recovery uses a phone and flow, never an entered email destination',
    () async {
      final flowId = 'a' * 64;
      final proof = 'b' * 64;
      var sends = 0;
      var verifies = 0;
      var resets = 0;
      await http.runWithClient(
        () async {
          final sent = await ApiService.sendEmailOtp(
            phone: '09171234567',
            purpose: 'password_reset',
          );
          expect(sent.flowId, flowId);
          await ApiService.sendEmailOtp(
            phone: '09171234567',
            purpose: 'password_reset',
            flowId: sent.flowId,
          );
          final verified = await ApiService.verifyEmailOtp(
            phone: '09171234567',
            flowId: sent.flowId,
            purpose: 'password_reset',
            otp: '123456',
          );
          expect(
            await ApiService.updatePassword(
              phone: '09171234567',
              recoveryMethod: 'email',
              flowId: sent.flowId,
              verificationToken: verified.token,
              newPassword: 'ValidPass1!',
            ),
            isTrue,
          );
        },
        () => MockClient((request) async {
          final body = jsonDecode(request.body) as Map<String, dynamic>;
          expect(body['phone'], '09171234567');
          expect(body.containsKey('email'), isFalse);
          if (request.url.path.endsWith('/send')) {
            if (sends > 0) expect(body['flowId'], flowId);
            sends++;
            return http.Response(
              jsonEncode({
                'flowId': flowId,
                'retryAfterSeconds': 60,
                'expiresInSeconds': 300,
              }),
              202,
            );
          }
          expect(body['flowId'], flowId);
          if (request.url.path.endsWith('/verify')) {
            verifies++;
            expect(body['otp'], '123456');
            return http.Response(
              jsonEncode({'verificationToken': proof, 'expiresInSeconds': 600}),
              200,
            );
          }
          resets++;
          expect(body['recoveryMethod'], 'email');
          expect(body['verificationToken'], proof);
          return http.Response('{"success":true}', 200);
        }),
      );
      expect([sends, verifies, resets], [2, 1, 1]);
    },
  );

  test(
    'missing account-scoped flow in send response requires restarting recovery',
    () async {
      await http.runWithClient(
        () => expectLater(
          ApiService.sendEmailOtp(
            phone: '09171234567',
            purpose: 'password_reset',
          ),
          throwsA(
            isA<ApiException>().having(
              (error) => error.code,
              'code',
              'INVALID_RESPONSE',
            ),
          ),
        ),
        () => MockClient(
          (_) async => http.Response('{"expiresInSeconds":300}', 202),
        ),
      );
    },
  );
  test('recovery emails normalize case and surrounding whitespace', () {
    expect(
      normalizeRecoveryEmail(' Alice+Test@Example.COM \n'),
      'alice+test@example.com',
    );
    expect(validateRecoveryEmail(' Alice+Test@Example.COM \n'), isNull);
    expect(validateRecoveryEmail('test@example.technology'), isNull);
  });
  test(
    'email validation rejects invalid identities and permits removing optional email',
    () {
      for (final email in [
        'a..b@example.com',
        '.a@example.com',
        'a @example.com',
        'bad',
      ]) {
        expect(validateRecoveryEmail(email), isNotNull);
      }
      expect(validateRecoveryEmail('  '), isNull);
      expect(validateRecoveryEmail('  ', required: true), isNotNull);
    },
  );
}
