import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:google_fonts/src/google_fonts_base.dart' as fonts;
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:foodsafe_manila/screens/dashboard/home_screen.dart';
import 'package:foodsafe_manila/services/location_service.dart';
import 'package:foodsafe_manila/services/manila_geo_service.dart';
import 'package:foodsafe_manila/services/policy_service.dart';

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
  const channel = MethodChannel('lyokone/location');
  late String policyJson;
  late Map<String, double> point;
  var gpsCalls = 0;
  var permissionRequests = 0;
  var permission = 1;
  var requestedPermission = 1;
  Completer<Map<String, double>>? pendingPosition;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    LocationService.clearCachedLocation();
    PolicyService.requestLocationDisclosure = null;
    policyJson = await File('assets/mobile-policies.json').readAsString();
    final bundle = PolicyBundle.fromJson(
      jsonDecode(policyJson) as Map<String, dynamic>,
    );
    await PolicyService.setLocationEnabled(
      true,
      version: bundle.policy('location').version,
    );
    gpsCalls = 0;
    permissionRequests = 0;
    permission = 1;
    requestedPermission = 1;
    pendingPosition = null;

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
    final bytes = ByteData.sublistView(
      await File.fromUri(
        Uri.parse(root).resolve(
          '../../bin/cache/artifacts/material_fonts/Roboto-Regular.ttf',
        ),
      ).readAsBytes(),
    );
    final logo = ByteData.sublistView(
      await File('assets/foodsafe_logo.png').readAsBytes(),
    );
    final geography = ByteData.sublistView(
      await File(
        'assets/manila-barangays-with-legislative-districts.json',
      ).readAsBytes(),
    );
    fonts.assetManifest = _OfflineFonts();
    final messenger =
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    messenger.setMockMessageHandler('flutter/assets', (message) async {
      final path = utf8.decode(message!.buffer.asUint8List());
      if (path == 'AssetManifest.bin') {
        return const StandardMessageCodec().encodeMessage({
          'assets/foodsafe_logo.png': [
            {'asset': 'assets/foodsafe_logo.png'},
          ],
        });
      }
      if (path == 'assets/foodsafe_logo.png') return logo;
      if (path == 'assets/manila-barangays-with-legislative-districts.json') {
        return geography;
      }
      return path.startsWith('test-fonts/') ? bytes : null;
    });
    await ManilaGeoService.ensureLoaded();
    point = ManilaGeoService.centroidForBarangay(1)!;
    messenger.setMockMethodCallHandler(channel, (call) async {
      switch (call.method) {
        case 'serviceEnabled':
          return 1;
        case 'hasPermission':
          return permission;
        case 'requestPermission':
          permissionRequests++;
          return requestedPermission;
        case 'getLocation':
          gpsCalls++;
          final position =
              await (pendingPosition?.future ?? Future.value(point));
          return {'latitude': position['lat'], 'longitude': position['lng']};
        default:
          throw StateError('Unexpected location call: ${call.method}');
      }
    });
    addTearDown(() {
      fonts.assetManifest = null;
      messenger.setMockMessageHandler('flutter/assets', null);
      messenger.setMockMethodCallHandler(channel, null);
      LocationService.clearCachedLocation();
      PolicyService.locationEnabled = false;
    });
  });

  Future<void> showHome(
    WidgetTester tester,
    GlobalKey<HomeScreenState> key,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: HomeScreen(key: key, onProfilePressed: () {}),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('first display loads GPS immediately after permission grant', (
    tester,
  ) async {
    permission = 0;
    await http.runWithClient(() async {
      final key = GlobalKey<HomeScreenState>();
      await showHome(tester, key);
      expect(permissionRequests, 1);
      expect(gpsCalls, 1);
      expect(key.currentState!.isLocationLoading, isFalse);
      expect(key.currentState!.locationText, contains('Barangay'));
      expect(find.text(key.currentState!.locationText), findsOneWidget);
      expect(tester.takeException(), isNull);
    }, () => MockClient((_) async => http.Response(policyJson, 200)));
  });

  testWidgets('OS permission alone does not bypass location opt-in', (
    tester,
  ) async {
    await PolicyService.setLocationEnabled(false);
    await http.runWithClient(() async {
      final key = GlobalKey<HomeScreenState>();
      await showHome(tester, key);
      expect(gpsCalls, 0);
      expect(key.currentState!.locationText, 'Location unavailable');
      final bundle = PolicyBundle.fromJson(
        jsonDecode(policyJson) as Map<String, dynamic>,
      );
      await PolicyService.setLocationEnabled(
        true,
        version: bundle.policy('location').version,
      );
      final refresh = key.currentState!.refreshData();
      await tester.pumpAndSettle();
      await refresh;
      expect(gpsCalls, 1);
      expect(key.currentState!.locationText, contains('Barangay'));
      await PolicyService.setLocationEnabled(false);
      final disabledRefresh = key.currentState!.refreshData();
      await tester.pumpAndSettle();
      await disabledRefresh;
      expect(gpsCalls, 1);
      expect(key.currentState!.locationText, 'Location unavailable');
    }, () => MockClient((_) async => http.Response(policyJson, 200)));
  });

  testWidgets('denied permission stops loading without querying GPS', (
    tester,
  ) async {
    permission = 0;
    requestedPermission = 0;
    await http.runWithClient(() async {
      final key = GlobalKey<HomeScreenState>();
      await showHome(tester, key);
      expect(permissionRequests, 1);
      expect(gpsCalls, 0);
      expect(key.currentState!.isLocationLoading, isFalse);
      expect(key.currentState!.locationText, 'Location unavailable');
    }, () => MockClient((_) async => http.Response(policyJson, 200)));
  });

  testWidgets('simultaneous refreshes do not duplicate a pending GPS request', (
    tester,
  ) async {
    pendingPosition = Completer<Map<String, double>>();
    await http.runWithClient(() async {
      final key = GlobalKey<HomeScreenState>();
      await showHome(tester, key);
      expect(key.currentState!.isLocationLoading, isTrue);
      await key.currentState!.refreshData();
      await tester.pumpAndSettle();
      expect(gpsCalls, 1);
      pendingPosition!.complete(point);
      await tester.pumpAndSettle();
      expect(key.currentState!.isLocationLoading, isFalse);
      expect(key.currentState!.locationText, contains('Barangay'));
    }, () => MockClient((_) async => http.Response(policyJson, 200)));
  });

  testWidgets('slow GPS stops loading after timeout and tolerates disposal', (
    tester,
  ) async {
    pendingPosition = Completer<Map<String, double>>();
    await http.runWithClient(() async {
      final key = GlobalKey<HomeScreenState>();
      await showHome(tester, key);
      await tester.pump(const Duration(seconds: 26));
      expect(key.currentState!.isLocationLoading, isFalse);
      expect(key.currentState!.locationText, 'Location unavailable');
      await tester.pumpWidget(const SizedBox.shrink());
      pendingPosition!.complete(point);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    }, () => MockClient((_) async => http.Response(policyJson, 200)));
  });
}
