import 'package:flutter_test/flutter_test.dart';
import 'package:foodsafe_manila/utils/recovery_email.dart';

void main() {
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
