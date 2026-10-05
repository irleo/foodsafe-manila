import 'dart:async';
import 'dart:convert';
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

import 'package:foodsafe_manila/screens/legal/policy_screen.dart';
import 'package:foodsafe_manila/screens/reporting/report_form_screen.dart';
import 'package:foodsafe_manila/services/api_client.dart';
import 'package:foodsafe_manila/services/policy_service.dart';
import 'package:foodsafe_manila/services/session.dart';

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

Future<void> _checkAll(
  WidgetTester tester,
  String policyJson, {
  bool includeAccountChoices = true,
}) async {
  final bundle = PolicyBundle.fromJson(
    jsonDecode(policyJson) as Map<String, dynamic>,
  );
  final labels = [
    if (includeAccountChoices) 'I accept the Terms of Use (required).',
    if (includeAccountChoices) 'I acknowledge the Privacy Policy.',
    'I have read the reporting disclosure.',
    'I agree to use device location for this reporting feature.',
    bundle.healthConsentText,
  ];
  for (final label in labels) {
    await tester.scrollUntilVisible(find.text(label), 150);
    await tester.pumpAndSettle();
    await tester.tap(find.text(label));
    await tester.pumpAndSettle();
  }
  await tester.scrollUntilVisible(find.text('Continue to report'), 150);
  await tester.pumpAndSettle();
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
    fonts.assetManifest = _OfflineFonts();
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
  });
  tearDown(() async => Session.clear());

  testWidgets(
    'signup policy links open readers without accepting the checkboxes',
    (tester) async {
      var termsAccepted = false;
      var privacyAcknowledged = false;
      await http.runWithClient(() async {
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: PolicyChoices(
                termsAccepted: false,
                privacyAcknowledged: false,
                showLinks: false,
                inlineLinks: true,
                onTermsChanged: (value) => termsAccepted = value,
                onPrivacyChanged: (value) => privacyAcknowledged = value,
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.byType(PolicyLinks), findsNothing);
        expect(find.byType(Checkbox), findsNWidgets(2));
        for (final entry in {
          'Terms of Use': 'terms',
          'Privacy Policy': 'privacy',
        }.entries) {
          await tester.tap(find.text(entry.key));
          await tester.pumpAndSettle();
          expect(
            tester.widget<PolicyScreen>(find.byType(PolicyScreen)).type,
            entry.value,
          );
          expect(termsAccepted, isFalse);
          expect(privacyAcknowledged, isFalse);
          tester.state<NavigatorState>(find.byType(Navigator).first).pop();
          await tester.pumpAndSettle();
        }
        await tester.tap(find.byType(Checkbox).first);
        await tester.pumpAndSettle();
        expect(termsAccepted, isTrue);
        expect(privacyAcknowledged, isFalse);
        expect(tester.takeException(), isNull);
      }, () => MockClient((_) async => http.Response(policyJson, 200)));
    },
  );

  MockClient client({bool requiresAcknowledgement = true}) =>
      MockClient((request) async {
        if (request.url.path == '/api/auth/mobile/policies/status') {
          return http.Response(
            jsonEncode({'requiresAcknowledgement': requiresAcknowledgement}),
            200,
          );
        }
        expect(request.url.path, '/api/auth/mobile/policies');
        return http.Response(policyJson, 200);
      });

  testWidgets('all notices open inline without policy links or another page', (
    tester,
  ) async {
    await http.runWithClient(() async {
      await tester.pumpWidget(
        MaterialApp(
          home: ReportingDisclosureScreen(onContinue: (_, _, _) async {}),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(ExpansionTile), findsNWidgets(4));
      expect(find.byType(PolicyLinks), findsNothing);
      expect(find.byType(PolicyScreen), findsNothing);
      await tester.tap(find.text('Terms of Use'));
      await tester.pumpAndSettle();
      final bundle = PolicyBundle.fromJson(
        jsonDecode(policyJson) as Map<String, dynamic>,
      );
      expect(find.text(bundle.policy('terms').text), findsOneWidget);
      expect(find.text('Before you report'), findsOneWidget);
      expect(tester.takeException(), isNull);
    }, client);
  });

  testWidgets(
    'requires every choice and continues once with the reviewed bundle',
    (tester) async {
      await http.runWithClient(() async {
        int calls = 0;
        final pending = Completer<void>();
        await tester.pumpWidget(
          MaterialApp(
            home: ReportingDisclosureScreen(
              onContinue: (bundle, consent, acknowledgementRequired) async {
                calls++;
                expect(consent, isTrue);
                expect(acknowledgementRequired, isTrue);
                expect(bundle.policy('terms').version, isNotEmpty);
                await pending.future;
              },
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(
          tester
              .widgetList<CheckboxListTile>(find.byType(CheckboxListTile))
              .every((tile) => tile.value == false),
          isTrue,
        );
        await _checkAll(tester, policyJson);
        await tester.tap(find.text('Continue to report'));
        await tester.pump();
        expect(calls, 1);
        expect(
          tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
          isNull,
        );
        pending.complete();
        await tester.pumpAndSettle();
        expect(find.byType(PolicyScreen), findsNothing);
      }, client);
    },
  );

  testWidgets('current account policies do not require another acceptance', (
    tester,
  ) async {
    await tester.runAsync(
      () => Session.saveTokens(
        accessToken: 'test-access',
        refreshToken: 'test-refresh',
        user: {
          '_id': 'citizen-1',
          'username': 'Tester',
          'phoneNumber': '09171234567',
        },
      ),
    );
    await http.runWithClient(() async {
      bool continued = false;
      await tester.pumpWidget(
        MaterialApp(
          home: ReportingDisclosureScreen(
            onContinue: (_, consent, acknowledgementRequired) async {
              expect(consent, isTrue);
              expect(acknowledgementRequired, isFalse);
              continued = true;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(PolicyChoices), findsNothing);
      expect(find.text('Terms of Use'), findsOneWidget);
      expect(find.text('Privacy Policy'), findsOneWidget);
      await _checkAll(tester, policyJson, includeAccountChoices: false);
      await tester.tap(find.text('Continue to report'));
      await tester.pumpAndSettle();
      expect(continued, isTrue);
      expect(find.byType(PolicyScreen), findsNothing);
    }, () => client(requiresAcknowledgement: false));
  });

  testWidgets('changed policies reload and reset choices on the same page', (
    tester,
  ) async {
    await http.runWithClient(() async {
      await tester.pumpWidget(
        MaterialApp(
          home: ReportingDisclosureScreen(
            onContinue: (_, _, _) async {
              throw ApiException(
                400,
                'Policies changed. Please review again.',
                code: 'POLICY_ACCEPTANCE_REQUIRED',
              );
            },
          ),
        ),
      );
      await tester.pumpAndSettle();
      await _checkAll(tester, policyJson);
      await tester.tap(find.text('Continue to report'));
      await tester.pumpAndSettle();
      expect(find.text('Before you report'), findsOneWidget);
      expect(find.byType(PolicyScreen), findsNothing);
      await tester.scrollUntilVisible(find.text('Continue to report'), 150);
      await tester.pumpAndSettle();
      expect(
        tester
            .widgetList<CheckboxListTile>(find.byType(CheckboxListTile))
            .every((tile) => tile.value == false),
        isTrue,
      );
      expect(
        tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
        isNull,
      );
    }, client);
  });

  testWidgets(
    'later reports open the form directly when the saved receipt is current',
    (tester) async {
      await tester.runAsync(
        () => Session.saveTokens(
          accessToken: 'test-access',
          refreshToken: 'test-refresh',
          user: {
            '_id': 'citizen-1',
            'username': 'Tester',
            'phoneNumber': '09171234567',
          },
        ),
      );
      final bundle = PolicyBundle.fromJson(
        jsonDecode(policyJson) as Map<String, dynamic>,
      );
      await http.runWithClient(
        () async {
          await tester.pumpWidget(const MaterialApp(home: ReportFormScreen()));
          await tester.pumpAndSettle();
          expect(find.byType(ReportingDisclosureScreen), findsNothing);
          expect(find.text('Before you report'), findsNothing);
          expect(find.text('Next'), findsOneWidget);
          expect(tester.takeException(), isNull);
        },
        () => MockClient((request) async {
          if (request.url.path == '/api/auth/mobile/policies') {
            return http.Response(policyJson, 200);
          }
          if (request.url.path == '/api/auth/mobile/policies/status') {
            return http.Response(
              jsonEncode({
                'requiresAcknowledgement': false,
                'requiresReportingAcknowledgement': false,
                'reportingAcceptance': {
                  'version': bundle.policy('reporting').version,
                  'locationVersion': bundle.policy('location').version,
                  'lawfulBasis': bundle.lawfulBasis,
                  'healthConsent': true,
                  'acceptedAt': '2026-10-05T00:00:00Z',
                },
              }),
              200,
            );
          }
          expect(request.url.path, '/api/reports/user/citizen-1/last');
          return http.Response('{"lastReportAt":null}', 200);
        }),
      );
    },
  );

  test(
    'a changed reporting version requires review despite a previously saved receipt',
    () async {
      final bundle = PolicyBundle.fromJson(
        jsonDecode(policyJson) as Map<String, dynamic>,
      );
      final status = await http.runWithClient(
        () => PolicyService.reportingStatus(bundle),
        () => MockClient(
          (_) async => http.Response(
            jsonEncode({
              'requiresAcknowledgement': false,
              'requiresReportingAcknowledgement': false,
              'reportingAcceptance': {
                'version': 'old',
                'locationVersion': bundle.policy('location').version,
                'lawfulBasis': bundle.lawfulBasis,
                'healthConsent': true,
              },
            }),
            200,
          ),
        ),
      );
      expect(status.reportingAcknowledgementRequired, isTrue);
      expect(status.accountAcknowledgementRequired, isFalse);
    },
  );

  for (final requireAcknowledgement in [false, true]) {
    testWidgets(
      'profile reader shows account checkboxes only for an explicit update gate ($requireAcknowledgement)',
      (tester) async {
        await tester.runAsync(
          () => Session.saveTokens(
            accessToken: 'test-access',
            refreshToken: 'test-refresh',
            user: {
              '_id': 'citizen-1',
              'username': 'Tester',
              'phoneNumber': '09171234567',
            },
          ),
        );
        final shortPolicies = jsonDecode(policyJson) as Map<String, dynamic>;
        for (final document
            in (shortPolicies['policies'] as List<dynamic>)
                .cast<Map<String, dynamic>>()) {
          document['text'] = '## Policy heading\n\nShort policy text.';
        }
        await http.runWithClient(
          () async {
            await tester.pumpWidget(
              MaterialApp(
                home: PolicyScreen(
                  requireAcknowledgement: requireAcknowledgement,
                ),
              ),
            );
            await tester.pumpAndSettle();
            await tester.scrollUntilVisible(
              find.text('Use device location (optional)'),
              400,
              scrollable: find.byType(Scrollable).first,
            );
            await tester.pumpAndSettle();
            if (requireAcknowledgement) {
              await tester.scrollUntilVisible(
                find.text('Save acknowledgement'),
                150,
                scrollable: find.byType(Scrollable).first,
              );
              await tester.pumpAndSettle();
              expect(find.byType(PolicyChoices), findsOneWidget);
              expect(find.byType(CheckboxListTile), findsNWidgets(2));
            } else {
              expect(find.byType(PolicyChoices), findsNothing);
              expect(find.byType(CheckboxListTile), findsNothing);
              expect(find.text('Save acknowledgement'), findsNothing);
            }
            expect(find.textContaining('## Policy heading'), findsNothing);
            expect(tester.takeException(), isNull);
          },
          () => MockClient(
            (_) async => http.Response(jsonEncode(shortPolicies), 200),
          ),
        );
      },
    );
  }
}
