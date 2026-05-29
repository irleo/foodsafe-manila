import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'api_service.dart';
import 'debug_location_service.dart';
import 'location_service.dart';
import 'manila_geo_service.dart';
import 'notification_service.dart';

class RiskAlertService {
  static final RiskAlertService instance = RiskAlertService._();
  RiskAlertService._();

  Timer? _timer;
  int? _lastAlertedBarangayNo;
  final ValueNotifier<String?> latestMessage = ValueNotifier(null);
  final ValueNotifier<bool> isHighRiskArea = ValueNotifier(false);

  void startMonitoring({Duration interval = const Duration(seconds: 45)}) {
    _timer?.cancel();
    _timer = Timer.periodic(interval, (_) => _checkPosition());
    _checkPosition();
  }

  void stopMonitoring() {
    _timer?.cancel();
    _timer = null;
  }

  Future<void> _checkPosition() async {
    try {
      final permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return;
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
        ),
      );

      await ManilaGeoService.ensureLoaded();
      final simulated = await DebugLocationService.getSimulatedLocation();
      final location = simulated ??
          await LocationService.resolveManilaLocation() ??
          ManilaGeoService.lookup(
            position.latitude,
            position.longitude,
          );
      if (location == null) return;

      final nearby = await ApiService.getNearbyRisk(
        barangayNo: location.barangayNo,
      );
      if (nearby == null) return;

      final high = nearby['isHighRisk'] == true;
      isHighRiskArea.value = high;

      if (high) {
        final area = nearby['area'] as Map<String, dynamic>?;
        final score = area?['riskScore'] ?? 0;
        final msg =
            'High-risk area: ${location.formatted}. Risk score $score. Exercise caution.';
        latestMessage.value = msg;

        if (_lastAlertedBarangayNo != location.barangayNo) {
          _lastAlertedBarangayNo = location.barangayNo;
          await NotificationService.showHighRiskAlert(
            id: location.barangayNo,
            title: 'High-risk area nearby',
            body: msg,
          );
        }
      } else {
        latestMessage.value = null;
        _lastAlertedBarangayNo = null;
      }
    } catch (_) {
      // Ignore transient GPS/API errors during background checks.
    }
  }
}
