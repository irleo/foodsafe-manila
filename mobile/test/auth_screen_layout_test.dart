import 'dart:convert';
import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:google_fonts/src/google_fonts_base.dart' as fonts;
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:foodsafe_manila/screens/auth/sign_in_screen.dart';
import 'package:foodsafe_manila/screens/auth/sign_up_screen.dart';
import 'package:foodsafe_manila/screens/auth/change_password_screen.dart';
import 'package:foodsafe_manila/screens/legal/policy_screen.dart';
import 'package:foodsafe_manila/services/policy_service.dart';
import 'package:foodsafe_manila/services/session.dart';
import 'package:foodsafe_manila/widgets/step_progress_indicator.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

class _OfflineFonts implements AssetManifest {
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
  late String policyJson;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
    await Session.initialize();
    PolicyService.locationEnabled = false;
    policyJson = await File('assets/mobile-policies.json').readAsString();
    GoogleFonts.config.allowRuntimeFetching = false;
    final config =
        jsonDecode(await File('.dart_tool/package_config.json').readAsString())
            as Map;
    final flutter = (config['packages'] as List).cast<Map>().singleWhere(
      (item) => item['name'] == 'flutter',
    );
    final root = (flutter['rootUri'] as String).replaceFirst(
      RegExp(r'/*$'),
      '/',
    );
    final uri = Uri.parse(
      root,
    ).resolve('../../bin/cache/artifacts/material_fonts/Roboto-Regular.ttf');
    final bytes = ByteData.sublistView(await File.fromUri(uri).readAsBytes());
    final logo = ByteData.sublistView(
      await File('assets/foodsafe_logo.png').readAsBytes(),
    );
    fonts.assetManifest = _OfflineFonts();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMessageHandler('flutter/assets', (message) async {
          final path = utf8.decode(message!.buffer.asUint8List());
          if (path == 'AssetManifest.bin') {
            return const StandardMessageCodec().encodeMessage({
              'assets/foodsafe_logo.png': [
                {'asset': 'assets/foodsafe_logo.png'},
              ],
            });
          }
          if (path == 'assets/foodsafe_logo.png') return logo;
          return path.startsWith('test-fonts/') ? bytes : null;
        });
    addTearDown(() {
      fonts.assetManifest = null;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMessageHandler('flutter/assets', null);
    });
  });
  tearDown(() async => Session.clear());

  for (var step = 0; step <= 3; step++) {
    testWidgets('shared indicator renders step $step with large text', (
      tester,
    ) async {
      final semantics = tester.ensureSemantics();
      try {
        tester.view.physicalSize = const Size(320, 640);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        const titles = ['Symptoms', 'Food source', 'Review'];
        final caption = step == 3
            ? 'Report submitted'
            : 'Step ${step + 1} of 3 \u00b7 ${titles[step]}';
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: MediaQuery(
                data: const MediaQueryData(textScaler: TextScaler.linear(2)),
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: StepProgressIndicator(
                    currentStep: step,
                    titles: titles,
                    completedLabel: 'Report submitted',
                  ),
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text(caption), findsOneWidget);
        expect(find.bySemanticsLabel(caption), findsOneWidget);
        expect(find.byIcon(LucideIcons.check), findsNWidgets(step));
        for (var index = step; index < 3; index++) {
          expect(find.text('${index + 1}'), findsOneWidget);
        }
        expect(tester.takeException(), isNull);
      } finally {
        semantics.dispose();
      }
    });
  }

  for (final isForgot in [true, false]) {
    testWidgets('password indicator fits a narrow screen: forgot=$isForgot', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        MaterialApp(home: ChangePasswordScreen(isForgot: isForgot)),
      );
      await tester.pumpAndSettle();
      expect(find.byType(StepProgressIndicator), findsOneWidget);
      expect(find.text('Step 1 of 3 \u00b7 Account info'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    });
  }

  for (final signup in [true, false]) {
    testWidgets(
      '${signup ? 'signup' : 'recovery'} uses server timing, blocks parallel actions and retains proof on failure',
      (tester) async {
        tester.view.physicalSize = const Size(480, 1000);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final proofResponse = Completer<http.Response>();
        var verifies = 0;
        var commits = 0;
        await http.runWithClient(
          () async {
            await tester.pumpWidget(
              MaterialApp(
                home: signup
                    ? const SignUpScreen()
                    : const ChangePasswordScreen(isForgot: true),
              ),
            );
            await tester.pumpAndSettle();
            expect(find.byType(StepProgressIndicator), findsOneWidget);
            expect(
              find.text(
                signup
                    ? 'Step 1 of 3 \u00b7 Personal info'
                    : 'Step 1 of 3 \u00b7 Account info',
              ),
              findsOneWidget,
            );
            if (signup) {
              await tester.enterText(
                find.byType(TextFormField).at(0),
                'Test Citizen',
              );
              await tester.enterText(
                find.byType(TextFormField).at(1),
                '9171234567',
              );
              for (var i = 0; i < 2; i++) {
                await tester.ensureVisible(find.byType(Checkbox).at(i));
                await tester.tap(find.byType(Checkbox).at(i));
                await tester.pumpAndSettle();
              }
            } else {
              await tester.tap(find.text('Use recovery email'));
              await tester.pumpAndSettle();
              await tester.enterText(
                find.byKey(const ValueKey('email-field')),
                'tester@example.com',
              );
            }
            final next = find.widgetWithText(
              ElevatedButton,
              signup ? 'Continue' : 'Submit',
            );
            await tester.ensureVisible(next);
            await tester.tap(next);
            await tester.pumpAndSettle();
            expect(
              find.text(
                signup
                    ? 'Step 2 of 3 \u00b7 Security'
                    : 'Step 2 of 3 \u00b7 New password',
              ),
              findsOneWidget,
            );
            for (var i = 0; i < 2; i++) {
              await tester.enterText(
                find.byType(TextFormField).at(i),
                'Testing123!',
              );
            }
            final confirm = find.widgetWithText(
              ElevatedButton,
              signup ? 'Continue' : 'Confirm',
            );
            await tester.ensureVisible(confirm);
            await tester.tap(confirm);
            await tester.pumpAndSettle();
            expect(
              find.text('Step 3 of 3 \u00b7 Verification'),
              findsOneWidget,
            );
            expect(find.text('Resend in 37 s'), findsOneWidget);
            for (var i = 0; i < 6; i++) {
              await tester.enterText(
                find.byType(TextFormField).at(i),
                '${i + 1}',
              );
            }
            final commit = find.widgetWithText(
              ElevatedButton,
              signup ? 'Create account' : 'Verify',
            );
            await tester.ensureVisible(commit);
            await tester.tap(commit);
            await tester.pump();
            expect(verifies, 1);
            expect(
              tester
                  .widget<ElevatedButton>(find.byType(ElevatedButton).last)
                  .onPressed,
              isNull,
            );
            expect(
              tester
                  .widget<TextButton>(
                    find.widgetWithText(TextButton, 'Resend in 37 s'),
                  )
                  .onPressed,
              isNull,
            );
            proofResponse.complete(
              http.Response(
                '{"verificationToken":"proof","expiresInSeconds":600}',
                200,
              ),
            );
            await tester.pumpAndSettle();
            expect(commits, 1);
            await tester.ensureVisible(commit);
            await tester.tap(commit);
            await tester.pumpAndSettle();
            expect(verifies, 1);
            expect(commits, 2);
            expect(tester.takeException(), isNull);
            tester
                .state<ScaffoldMessengerState>(find.byType(ScaffoldMessenger))
                .removeCurrentSnackBar();
            await tester.pumpWidget(const SizedBox.shrink());
          },
          () => MockClient((request) async {
            final path = request.url.path;
            if (path.endsWith('/policies')) {
              return http.Response(policyJson, 200);
            }
            if (path.endsWith('/exists')) {
              return http.Response('{"exists":false}', 200);
            }
            if (path.endsWith('/otp/send')) {
              return http.Response(
                '{"expiresInSeconds":300,"retryAfterSeconds":37}',
                signup ? 200 : 202,
              );
            }
            if (path.endsWith('/otp/verify')) {
              verifies++;
              return proofResponse.future;
            }
            expect(path, endsWith(signup ? '/register' : '/reset-password'));
            expect(
              (jsonDecode(request.body) as Map)['verificationToken'],
              'proof',
            );
            commits++;
            return http.Response('{"message":"Temporarily unavailable"}', 503);
          }),
        );
      },
    );
  }

  testWidgets(
    'signup keeps linked choices before Continue and OTP fits a narrow screen',
    (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await http.runWithClient(
        () async {
          await tester.pumpWidget(const MaterialApp(home: SignUpScreen()));
          await tester.pumpAndSettle();
          await tester.enterText(
            find.byType(TextFormField).at(0),
            'Test Citizen',
          );
          await tester.enterText(
            find.byType(TextFormField).at(1),
            '9171234567',
          );
          for (final checkbox
              in tester
                  .widgetList<Checkbox>(find.byType(Checkbox))
                  .toList()
                  .asMap()
                  .keys) {
            final target = find.byType(Checkbox).at(checkbox);
            await tester.ensureVisible(target);
            await tester.tap(target);
            await tester.pumpAndSettle();
          }
          expect(
            tester.getTopLeft(find.byType(PolicyChoices)).dy,
            lessThan(
              tester
                  .getTopLeft(find.widgetWithText(ElevatedButton, 'Continue'))
                  .dy,
            ),
          );
          await tester.ensureVisible(
            find.widgetWithText(ElevatedButton, 'Continue'),
          );
          await tester.tap(find.widgetWithText(ElevatedButton, 'Continue'));
          await tester.pumpAndSettle();
          expect(find.text('Set your password'), findsOneWidget);
          await tester.enterText(
            find.byType(TextFormField).at(0),
            'Testing123!',
          );
          await tester.enterText(
            find.byType(TextFormField).at(1),
            'Testing123!',
          );
          await tester.ensureVisible(
            find.widgetWithText(ElevatedButton, 'Continue'),
          );
          await tester.tap(find.widgetWithText(ElevatedButton, 'Continue'));
          await tester.pumpAndSettle();
          expect(find.text('Verification code'), findsOneWidget);
          expect(find.byType(TextFormField), findsNWidgets(6));
          expect(tester.takeException(), isNull);
          await tester.pumpWidget(const SizedBox.shrink());
        },
        () => MockClient((request) async {
          if (request.url.path.endsWith('/policies')) {
            return http.Response(policyJson, 200);
          }
          if (request.url.path.endsWith('/exists')) {
            return http.Response('{"exists":false}', 200);
          }
          expect(request.url.path, endsWith('/otp/send'));
          return http.Response('{"expiresInSeconds":300}', 200);
        }),
      );
    },
  );
  for (final size in [
    const Size(320, 640),
    const Size(800, 1000),
    const Size(640, 320),
  ]) {
    for (final signUp in [false, true]) {
      testWidgets(
        'auth layout: $size signup=$signUp with large text and keyboard',
        (tester) async {
          tester.view.physicalSize = size;
          tester.view.devicePixelRatio = 1;
          addTearDown(tester.view.resetPhysicalSize);
          addTearDown(tester.view.resetDevicePixelRatio);
          await http.runWithClient(() async {
            await tester.pumpWidget(
              MaterialApp(
                builder: (context, child) => MediaQuery(
                  data: MediaQuery.of(
                    context,
                  ).copyWith(textScaler: const TextScaler.linear(2)),
                  child: child!,
                ),
                home: signUp ? const SignUpScreen() : const SignInScreen(),
              ),
            );
            await tester.pumpAndSettle();
            expect(tester.takeException(), isNull);
            final action = find.widgetWithText(
              ElevatedButton,
              signUp ? 'Continue' : 'Sign In',
            );
            await tester.ensureVisible(action);
            await tester.pumpAndSettle();
            expect(action, findsOneWidget);
            tester.view.viewInsets = const FakeViewPadding(bottom: 240);
            await tester.pumpAndSettle();
            await tester.ensureVisible(action);
            await tester.pumpAndSettle();
            expect(tester.takeException(), isNull);
            tester.view.resetViewInsets();
            await tester.pumpWidget(const SizedBox.shrink());
          }, () => MockClient((_) async => http.Response(policyJson, 200)));
        },
      );
    }
  }
}
