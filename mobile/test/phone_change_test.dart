import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:foodsafe_manila/screens/account/account_information_screen.dart';
import 'package:foodsafe_manila/services/session.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:google_fonts/src/google_fonts_base.dart' as fonts;
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

const originalPhone = '09179999999';
const newPhone = '09171234567';
const profile = {
  '_id': 'citizen-1',
  'username': 'Tester',
  'phoneNumber': originalPhone,
  'email': '',
  'emailVerified': false,
};
final flow = {
  'flowId': List.filled(64, 'a').join(),
  'maskedPhone': '+63 *** *** 4567',
  'expiresInSeconds': 300,
  'retryAfterSeconds': 0,
};
http.Response json(Object body, [int status = 200]) =>
    http.Response(jsonEncode(body), status);

Future<void> begin(WidgetTester tester, {bool waitForSend = true}) async {
  await tester.pumpWidget(const MaterialApp(home: AccountInformationScreen()));
  await tester.pumpAndSettle();
  await tester.ensureVisible(find.text('Edit profile'));
  await tester.tap(find.text('Edit profile'));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextFormField).at(1), '9171234567');
  await tester.pumpAndSettle();
  await tester.enterText(
    find.byKey(const ValueKey('contact-current-password')),
    'CurrentPass1!',
  );
  await tester.ensureVisible(find.text('Save changes'));
  await tester.tap(find.text('Save changes'));
  if (waitForSend) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
  }
}

Future<void> code(WidgetTester tester) async {
  final fields = find.byType(TextFormField);
  for (var i = 0; i < 6; i++) {
    await tester.enterText(fields.at(i), '${i + 1}');
  }
  await tester.ensureVisible(find.text('Verify'));
}

class OfflineFonts implements AssetManifest {
  @override
  List<String> listAssets() => [
    'Regular',
    'Medium',
    'SemiBold',
    'Bold',
    'ExtraBold',
  ].map((weight) => 'test-fonts/Inter-$weight.ttf').toList();
  @override
  List<AssetMetadata>? getAssetVariants(String key) => null;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() async {
    GoogleFonts.config.allowRuntimeFetching = false;
    // Supply a bundled SDK font for font-loading tests without network or caches.
    final config =
        jsonDecode(await File('.dart_tool/package_config.json').readAsString())
            as Map;
    final flutter = (config['packages'] as List).cast<Map>().singleWhere(
      (p) => p['name'] == 'flutter',
    );
    final root = (flutter['rootUri'] as String).replaceFirst(
      RegExp(r'/*$'),
      '/',
    );
    final uri = Uri.parse(
      root,
    ).resolve('../../bin/cache/artifacts/material_fonts/Roboto-Regular.ttf');
    final bytes = ByteData.sublistView(await File.fromUri(uri).readAsBytes());
    fonts.assetManifest = OfflineFonts();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMessageHandler('flutter/assets', (message) async {
          final path = utf8.decode(message!.buffer.asUint8List());
          return path.startsWith('test-fonts/') ? bytes : null;
        });
    addTearDown(() {
      fonts.assetManifest = null;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMessageHandler('flutter/assets', null);
    });
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
    await Session.initialize();
    await Session.saveTokens(
      accessToken: 'access',
      refreshToken: 'refresh',
      user: profile,
    );
  });
  void viewport(WidgetTester tester) {
    tester.view.physicalSize = const Size(390, 1000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
  }

  testWidgets('email save requires a password and never sends an OTP', (
    tester,
  ) async {
    viewport(tester);
    final requests = <String>[];
    await http.runWithClient(
      () async {
        await tester.pumpWidget(
          const MaterialApp(home: AccountInformationScreen()),
        );
        await tester.pumpAndSettle();
        expect(
          find.text(
            'No recovery email saved. Use SMS to recover your account.',
          ),
          findsOneWidget,
        );
        await tester.ensureVisible(find.text('Edit profile'));
        await tester.tap(find.text('Edit profile'));
        await tester.pumpAndSettle();
        await tester.enterText(
          find.byType(TextFormField).at(2),
          ' Alice@Example.COM ',
        );
        await tester.pumpAndSettle();
        final password = find.byKey(const ValueKey('contact-current-password'));
        expect(password, findsOneWidget);
        await tester.ensureVisible(find.text('Save changes'));
        await tester.tap(find.text('Save changes'));
        await tester.pumpAndSettle();
        expect(requests, isEmpty);
        await tester.enterText(password, 'CurrentPass1!');
        await tester.ensureVisible(find.text('Save changes'));
        await tester.runAsync(() async {
          await tester.tap(find.text('Save changes'));
          await Future<void>.delayed(const Duration(milliseconds: 50));
        });
        await tester.pumpAndSettle();
        await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 20)),
        );
        await tester.pumpAndSettle();
        expect(requests, ['/api/users/citizen-1']);
        expect(Session.currentUser!['email'], 'alice@example.com');
        expect(Session.currentUser!['emailVerified'], false);
        expect(find.text('Verification code'), findsNothing);
        expect(find.text('Edit profile'), findsOneWidget);
        expect(
          find.text('Recovery codes can be sent to this saved address.'),
          findsOneWidget,
        );
        expect(tester.takeException(), isNull);
        tester
            .state<ScaffoldMessengerState>(find.byType(ScaffoldMessenger))
            .removeCurrentSnackBar();
        await tester.pumpWidget(const SizedBox());
      },
      () => MockClient((request) async {
        if (request.url.path.endsWith('/policies/status')) {
          return json({'requiresAcknowledgement': false});
        }
        requests.add(request.url.path);
        expect(request.method, 'PUT');
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        expect(body['email'], 'alice@example.com');
        expect(body['currentPassword'], 'CurrentPass1!');
        return json({
          ...profile,
          'email': 'alice@example.com',
          'emailVerified': false,
        });
      }),
    );
  });

  testWidgets(
    'success commits OTP flow then updates saved phone, never before',
    (tester) async {
      viewport(tester);
      final completion = Completer<http.Response>();
      await http.runWithClient(
        () async {
          await begin(tester);
          expect(find.textContaining('+63 *** *** 4567'), findsOneWidget);
          expect(Session.currentUser!['phoneNumber'], originalPhone);
          await code(tester);
          await tester.runAsync(() async {
            await tester.tap(find.text('Verify'));
            await Future<void>.delayed(const Duration(milliseconds: 20));
          });
          await tester.pump();
          await tester.pump(const Duration(milliseconds: 100));
          expect(Session.currentUser!['phoneNumber'], originalPhone);
          expect(
            tester
                .widget<TextButton>(
                  find.widgetWithText(TextButton, 'Resend Code'),
                )
                .onPressed,
            isNull,
          );
          await tester.runAsync(() async {
            completion.complete(json({...profile, 'phoneNumber': newPhone}));
            await Future<void>.delayed(const Duration(milliseconds: 50));
          });
          await tester.pumpAndSettle();
          await tester.runAsync(
            () => Future<void>.delayed(const Duration(milliseconds: 20)),
          );
          await tester.pumpAndSettle();
          expect(Session.currentUser!['phoneNumber'], newPhone);
          expect(find.text('Edit profile'), findsOneWidget);
          expect(tester.takeException(), isNull);
          tester
              .state<ScaffoldMessengerState>(find.byType(ScaffoldMessenger))
              .removeCurrentSnackBar();
          await tester.pumpWidget(const SizedBox());
        },
        () => MockClient((request) async {
          if (request.url.path.endsWith('/policies/status')) {
            return json({'requiresAcknowledgement': false});
          }
          if (request.url.path.endsWith('/otp/send')) return json(flow);
          expect(request.method, 'PUT');
          final body = jsonDecode(request.body) as Map<String, dynamic>;
          expect(body['flowId'], flow['flowId']);
          expect(body['otp'], '123456');
          expect(body['phone'], newPhone);
          expect(body['currentPassword'], 'CurrentPass1!');
          return completion.future;
        }),
      );
    },
  );

  testWidgets('failed send keeps account editing and saved phone unchanged', (
    tester,
  ) async {
    viewport(tester);
    await http.runWithClient(
      () async {
        await begin(tester);
        expect(find.text('Verification code'), findsNothing);
        expect(find.text('Save changes'), findsOneWidget);
        expect(Session.currentUser!['phoneNumber'], originalPhone);
        expect(find.text('Could not send code'), findsOneWidget);
        await tester.pumpWidget(const SizedBox());
      },
      () => MockClient(
        (request) async => request.url.path.endsWith('/policies/status')
            ? json({'requiresAcknowledgement': false})
            : json({'message': 'Could not send code'}, 502),
      ),
    );
  });

  testWidgets('invalid OTP is a field error and cannot change saved phone', (
    tester,
  ) async {
    viewport(tester);
    await http.runWithClient(
      () async {
        await begin(tester);
        await code(tester);
        await tester.tap(find.text('Verify'));
        await tester.pumpAndSettle();
        expect(find.text('Incorrect code'), findsOneWidget);
        expect(Session.currentUser!['phoneNumber'], originalPhone);
        expect(find.text('Verification code'), findsOneWidget);
        await tester.pumpWidget(const SizedBox());
      },
      () => MockClient((request) async {
        if (request.url.path.endsWith('/policies/status')) {
          return json({'requiresAcknowledgement': false});
        }
        if (request.url.path.endsWith('/otp/send')) return json(flow);
        return json({'code': 'OTP_INVALID', 'message': 'Incorrect code'}, 400);
      }),
    );
  });

  testWidgets('expired OTP disables Verify and restarts with a new challenge', (
    tester,
  ) async {
    viewport(tester);
    var sends = 0;
    await http.runWithClient(
      () async {
        await begin(tester);
        await code(tester);
        await tester.tap(find.text('Verify'));
        await tester.pumpAndSettle();
        expect(
          tester
              .widget<ElevatedButton>(
                find.widgetWithText(ElevatedButton, 'Verify'),
              )
              .onPressed,
          isNull,
        );
        await tester.tap(find.text('Start again'));
        await tester.pumpAndSettle();
        expect(sends, 2);
        expect(find.text('Resend in 37 s'), findsOneWidget);
        expect(Session.currentUser!['phoneNumber'], originalPhone);
        await tester.pumpWidget(const SizedBox());
      },
      () => MockClient((request) async {
        if (request.url.path.endsWith('/policies/status')) {
          return json({'requiresAcknowledgement': false});
        }
        if (request.url.path.endsWith('/otp/send')) {
          sends++;
          expect((jsonDecode(request.body) as Map)['flowId'], isNull);
          return json(
            sends == 1
                ? flow
                : {
                    ...flow,
                    'flowId': List.filled(64, 'b').join(),
                    'retryAfterSeconds': 37,
                  },
          );
        }
        return json({
          'code': 'OTP_FLOW_EXPIRED',
          'message': 'Code expired',
        }, 410);
      }),
    );
  });

  testWidgets(
    'resend uses flow ID, clears old input and enforces backend cooldown',
    (tester) async {
      viewport(tester);
      var sends = 0;
      await http.runWithClient(
        () async {
          await begin(tester);
          await code(tester);
          await tester.ensureVisible(find.text('Resend Code'));
          await tester.tap(find.text('Resend Code'));
          await tester.pumpAndSettle();
          expect(sends, 2);
          expect(find.text('Resend in 37 s'), findsOneWidget);
          expect(
            tester
                .widget<TextButton>(
                  find.widgetWithText(TextButton, 'Resend in 37 s'),
                )
                .onPressed,
            isNull,
          );
          for (final field in tester.widgetList<TextFormField>(
            find.byType(TextFormField),
          )) {
            expect(field.controller!.text, isEmpty);
          }
          expect(Session.currentUser!['phoneNumber'], originalPhone);
          await tester.pumpWidget(const SizedBox());
        },
        () => MockClient((request) async {
          if (request.url.path.endsWith('/policies/status')) {
            return json({'requiresAcknowledgement': false});
          }
          sends++;
          if (sends > 1) {
            expect((jsonDecode(request.body) as Map)['flowId'], flow['flowId']);
          }
          return json({...flow, 'retryAfterSeconds': sends == 1 ? 0 : 37});
        }),
      );
    },
  );

  testWidgets(
    'interrupted send never changes saved phone or touches disposed screen',
    (tester) async {
      viewport(tester);
      final completion = Completer<http.Response>();
      await http.runWithClient(
        () async {
          // Start send but leave the widget before its response arrives.
          await begin(tester, waitForSend: false);
          await tester.pumpWidget(
            const MaterialApp(home: Text('Account closed')),
          );
          completion.complete(json(flow));
          await tester.pumpAndSettle();
          expect(Session.currentUser!['phoneNumber'], originalPhone);
          expect(find.text('Account closed'), findsOneWidget);
          expect(tester.takeException(), isNull);
        },
        () => MockClient(
          (request) async => request.url.path.endsWith('/policies/status')
              ? json({'requiresAcknowledgement': false})
              : completion.future,
        ),
      );
    },
  );
}
