import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:foodsafe_manila/screens/auth/change_password_screen.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  testWidgets('leaving email recovery is local and staying retains cooldown', (
    tester,
  ) async {
    GoogleFonts.config.allowRuntimeFetching = false;
    tester.view.physicalSize = const Size(480, 1000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final requests = <String>[];
    await http.runWithClient(
      () async {
        await tester.pumpWidget(
          MaterialApp(
            home: Builder(
              builder: (context) => Scaffold(
                body: TextButton(
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) =>
                          const ChangePasswordScreen(isForgot: true),
                    ),
                  ),
                  child: const Text('Open recovery'),
                ),
              ),
            ),
          ),
        );
        await tester.tap(find.text('Open recovery'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Use recovery email'));
        await tester.pumpAndSettle();
        await tester.enterText(
          find.byKey(const ValueKey('email-field')),
          'victim@example.com',
        );
        await tester.tap(find.text('Submit'));
        await tester.pumpAndSettle();
        final passwords = find.byType(TextFormField);
        await tester.enterText(passwords.at(0), 'ValidPass1!');
        await tester.enterText(passwords.at(1), 'ValidPass1!');
        await tester.ensureVisible(find.text('Confirm'));
        await tester.tap(find.text('Confirm'));
        await tester.pumpAndSettle();
        expect(requests, ['/api/auth/email/otp/send']);
        expect(find.textContaining('Resend in'), findsOneWidget);

        await tester.ensureVisible(find.text('Back'));
        await tester.tap(find.text('Back'));
        await tester.pumpAndSettle();
        expect(find.textContaining('expire automatically'), findsOneWidget);
        await tester.tap(find.text('Stay'));
        await tester.pumpAndSettle();
        expect(find.textContaining('Resend in'), findsOneWidget);
        expect(requests.length, 1);

        await tester.tap(find.text('Back'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Leave'));
        await tester.pumpAndSettle();
        expect(find.text('Open recovery'), findsOneWidget);
        expect(requests, ['/api/auth/email/otp/send']);
        expect(tester.takeException(), isNull);
      },
      () => MockClient((request) async {
        requests.add(request.url.path);
        expect(request.url.path, '/api/auth/email/otp/send');
        return http.Response('{"expiresInSeconds":300}', 202);
      }),
    );
  });
}
