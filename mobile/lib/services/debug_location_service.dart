import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'manila_geo_service.dart';

/// Debug-only simulated GPS within Manila for developers outside the city.
class DebugLocationService {
  DebugLocationService._();

  static const _enabledKey = 'debug_location_enabled';
  static const _districtKey = 'debug_location_district';
  static const _barangayNoKey = 'debug_location_barangay_no';

  static bool get isAvailable => kDebugMode;

  static Future<bool> isEnabled() async {
    if (!isAvailable) return false;
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_enabledKey) ?? false;
  }

  static Future<ManilaLocation?> getSimulatedLocation() async {
    if (!isAvailable) return null;
    if (!await isEnabled()) return null;

    final prefs = await SharedPreferences.getInstance();
    final district = prefs.getString(_districtKey);
    final barangayNo = prefs.getInt(_barangayNoKey);
    if (district == null || barangayNo == null || barangayNo <= 0) {
      return null;
    }

    await ManilaGeoService.ensureLoaded();
    return ManilaGeoService.locationForBarangay(
      district: district,
      barangayNo: barangayNo,
    );
  }

  static Future<Map<String, double>?> getSimulatedCoordinates() async {
    if (!isAvailable) return null;
    if (!await isEnabled()) return null;

    final prefs = await SharedPreferences.getInstance();
    final barangayNo = prefs.getInt(_barangayNoKey);
    if (barangayNo == null) return null;

    await ManilaGeoService.ensureLoaded();
    return ManilaGeoService.centroidForBarangay(barangayNo);
  }

  static Future<void> setSimulated({
    required String district,
    required int barangayNo,
  }) async {
    if (!isAvailable) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_enabledKey, true);
    await prefs.setString(_districtKey, district);
    await prefs.setInt(_barangayNoKey, barangayNo);
  }

  static Future<void> clear() async {
    if (!isAvailable) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_enabledKey, false);
    await prefs.remove(_districtKey);
    await prefs.remove(_barangayNoKey);
  }

  static Future<void> ensurePrefsReady() async {
    await SharedPreferences.getInstance();
  }
}
