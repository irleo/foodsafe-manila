import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:foodsafe_manila/screens/account/recovery_email_verification_screen.dart';
import 'package:foodsafe_manila/utils/recovery_email.dart';

void main() {
  testWidgets(
    'verification screen requires an explicit send and shows unverified recovery status',
    (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: RecoveryEmailVerificationScreen(email: 'alice@example.com'),
        ),
      );
      expect(find.text('Send verification code'), findsOneWidget);
      expect(
        find.text('This address cannot recover your account until verified.'),
        findsOneWidget,
      );
      expect(find.byType(TextField), findsNothing);
      expect(tester.takeException(), isNull);
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
