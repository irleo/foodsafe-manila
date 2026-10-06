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
  var serviceEnabled = true;
  Completer<Map<String, double>>? pendingPosition;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    LocationService.clearCachedLocation();
    policyJson = await File('assets/mobile-policies.json').readAsString();
    gpsCalls = 0;
    permissionRequests = 0;
    permission = 1;
    requestedPermission = 1;
    serviceEnabled = true;
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
        case 'requestService':
          return serviceEnabled ? 1 : 0;
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
      expect(
        tester
            .widget<InkWell>(find.byKey(const ValueKey('home-location-box')))
            .onTap,
        isNull,
      );
      expect(tester.takeException(), isNull);
    }, () => MockClient((_) async => http.Response(policyJson, 200)));
  });

  testWidgets(
    'phone permission controls location despite a legacy disabled opt-in',
    (tester) async {
      SharedPreferences.setMockInitialValues({
        'policy_location_enabled': false,
      });
      await http.runWithClient(() async {
        final key = GlobalKey<HomeScreenState>();
        await showHome(tester, key);
        expect(gpsCalls, 1);
        expect(permissionRequests, 0);
        expect(key.currentState!.locationText, contains('Barangay'));
        permission = 2;
        final refresh = key.currentState!.refreshData();
        await tester.pumpAndSettle();
        await refresh;
        expect(gpsCalls, 1);
        expect(LocationService.cachedManilaLocation, isNull);
        expect(key.currentState!.locationText, 'Location unavailable');
        permission = 1;
        final grantedRefresh = key.currentState!.refreshData();
        await tester.pumpAndSettle();
        await grantedRefresh;
        expect(gpsCalls, 2);
        expect(key.currentState!.locationText, contains('Barangay'));
      }, () => MockClient((_) async => http.Response(policyJson, 200)));
    },
  );

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

  testWidgets('disabled phone location still exposes the settings shortcut', (
    tester,
  ) async {
    serviceEnabled = false;
    final key = GlobalKey<HomeScreenState>();
    await showHome(tester, key);
    expect(gpsCalls, 0);
    expect(permissionRequests, 0);
    expect(key.currentState!.locationText, 'Location unavailable');
    expect(find.text('Location unavailable'), findsOneWidget);
    expect(
      tester
          .widget<InkWell>(find.byKey(const ValueKey('home-location-box')))
          .onTap,
      isNotNull,
    );
    expect(
      find.byKey(const ValueKey('home-location-settings')),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });

  for (final deniedPermission in [0, 2]) {
    testWidgets(
      'Home settings shortcut opens settings when permission is $deniedPermission',
      (tester) async {
        permission = deniedPermission;
        requestedPermission = deniedPermission;
        var settingsOpened = 0;
        const settingsChannel = MethodChannel(
          'flutter.baseflow.com/geolocator',
        );
        final messenger =
            TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
        messenger.setMockMethodCallHandler(settingsChannel, (call) async {
          expect(call.method, 'openAppSettings');
          settingsOpened++;
          return true;
        });
        addTearDown(
          () => messenger.setMockMethodCallHandler(settingsChannel, null),
        );
        final key = GlobalKey<HomeScreenState>();
        await showHome(tester, key);
        expect(key.currentState!.locationText, 'Location unavailable');
        expect(find.text('Please allow location access.'), findsOneWidget);
        final box = find.byKey(const ValueKey('home-location-box'));
        final icon = find.byKey(const ValueKey('home-location-settings'));
        expect(tester.widget<InkWell>(box).onTap, isNotNull);
        expect(
          find.descendant(of: icon, matching: find.byIcon(Icons.open_in_new)),
          findsOneWidget,
        );
        await tester.tap(deniedPermission == 0 ? box : icon);
        await tester.pumpAndSettle();
        expect(settingsOpened, 1);
        expect(permissionRequests, deniedPermission == 0 ? 1 : 0);
        expect(gpsCalls, 0);
        tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
        permission = 1;
        tester.binding.handleAppLifecycleStateChanged(
          AppLifecycleState.resumed,
        );
        await tester.pumpAndSettle();
        expect(gpsCalls, 1);
        expect(key.currentState!.locationText, contains('Barangay'));
        expect(tester.widget<InkWell>(box).onTap, isNull);
        expect(icon, findsNothing);
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets(
    'returning from phone settings automatically displays granted location',
    (tester) async {
      permission = 0;
      requestedPermission = 0;
      final key = GlobalKey<HomeScreenState>();
      await showHome(tester, key);
      expect(gpsCalls, 0);
      expect(permissionRequests, 1);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      permission = 1;
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();
      expect(gpsCalls, 1);
      expect(permissionRequests, 1);
      expect(find.text(key.currentState!.locationText), findsOneWidget);
      expect(key.currentState!.locationText, contains('Barangay'));
      expect(tester.takeException(), isNull);
    },
  );

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
      expect(
        find.byKey(const ValueKey('home-location-settings')),
        findsOneWidget,
      );
      expect(
        tester
            .widget<InkWell>(find.byKey(const ValueKey('home-location-box')))
            .onTap,
        isNotNull,
      );
      await tester.pumpWidget(const SizedBox.shrink());
      pendingPosition!.complete(point);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    }, () => MockClient((_) async => http.Response(policyJson, 200)));
  });
}
