import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:foodsafe_manila/screens/policy_screen.dart';
import 'package:foodsafe_manila/services/policy_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'bundled testing policies are readable without an API or legal gate',
    () async {
      final bundle = await PolicyService.loadBundled();
      expect(bundle.accountPublished, isTrue);
      expect(bundle.reportingPublished, isTrue);
      expect(bundle.policy('privacy').text, contains('Semaphore'));
      expect(bundle.policy('terms').text, contains('private testing'));
      expect(bundle.policy('privacy').text, contains('automatic deletion'));
    },
  );

  testWidgets('compact policy links wrap on narrow screens with large text', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MediaQuery(
            data: const MediaQueryData(textScaler: TextScaler.linear(2)),
            child: const Center(
              child: SizedBox(width: 320, child: PolicyLinks(compact: true)),
            ),
          ),
        ),
      ),
    );
    expect(find.text('Privacy Policy'), findsOneWidget);
    expect(find.text('Terms of Use'), findsOneWidget);
    for (final button in tester.widgetList<TextButton>(
      find.byType(TextButton),
    )) {
      expect(button.onPressed, isNotNull);
      expect(
        button.style!.textStyle!.resolve({})!.decoration,
        TextDecoration.underline,
      );
    }
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'required choices are unchecked and optional links can be hidden',
    (tester) async {
      bool? terms;
      bool? privacy;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: PolicyChoices(
              termsAccepted: false,
              privacyAcknowledged: false,
              showLinks: false,
              onTermsChanged: (value) => terms = value,
              onPrivacyChanged: (value) => privacy = value,
            ),
          ),
        ),
      );
      expect(find.byType(PolicyLinks), findsNothing);
      expect(
        tester
            .widgetList<CheckboxListTile>(find.byType(CheckboxListTile))
            .every((tile) => tile.value == false),
        isTrue,
      );
      await tester.tap(find.text('I accept the Terms of Use (required).'));
      expect(terms, isTrue);
      expect(privacy, isNull);
    },
  );
}
