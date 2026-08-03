import 'package:geocoding/geocoding.dart';
import 'package:location/location.dart' as loc;
import 'debug_location_service.dart';
import 'manila_geo_service.dart';

class LocationService {
  static final loc.Location _location = loc.Location();
  static String? cachedAddress;
  static ManilaLocation? cachedManilaLocation;

  static Future<void> preloadLocation() async {
    await ManilaGeoService.ensureLoaded();
    cachedAddress = await getUserAddress();
  }

  static Future<void> clearCache() async {
    cachedAddress = null;
    cachedManilaLocation = null;
  }

  static Future<bool> _handlePermission() async {
    bool serviceEnabled;
    loc.PermissionStatus permissionGranted;

    serviceEnabled = await _location.serviceEnabled();
    if (!serviceEnabled) {
      serviceEnabled = await _location.requestService();
      if (!serviceEnabled) return false;
    }

    permissionGranted = await _location.hasPermission();
    if (permissionGranted == loc.PermissionStatus.denied) {
      permissionGranted = await _location.requestPermission();
      if (permissionGranted != loc.PermissionStatus.granted) {
        return false;
      }
    }

    return true;
  }

  static Future<ManilaLocation?> resolveManilaLocation({
    bool forceRefresh = false,
  }) async {
    if (cachedManilaLocation != null && !forceRefresh) {
      return cachedManilaLocation;
    }

    final simulated = await DebugLocationService.getSimulatedLocation();
    if (simulated != null) {
      cachedManilaLocation = simulated;
      cachedAddress = simulated.formatted;
      return simulated;
    }

    final hasPermission = await _handlePermission();
    if (!hasPermission) return null;

    try {
      await ManilaGeoService.ensureLoaded();
      final locData = await _location.getLocation();
      if (locData.latitude == null || locData.longitude == null) return null;

      final resolved = ManilaGeoService.lookup(
        locData.latitude!,
        locData.longitude!,
      );

      cachedManilaLocation = resolved;
      if (resolved != null) {
        cachedAddress = resolved.formatted;
      }
      return resolved;
    } catch (_) {
      return null;
    }
  }

  static Future<String> getUserAddress({bool forceRefresh = false}) async {
    if (cachedAddress != null && !forceRefresh) return cachedAddress!;

    final simulated = await DebugLocationService.getSimulatedLocation();
    if (simulated != null) return simulated.formatted;

    final hasPermission = await _handlePermission();
    if (!hasPermission) return 'Location unavailable';

    try {
      final locData = await _location.getLocation();
      if (locData.latitude == null || locData.longitude == null) {
        return 'Location unavailable';
      }

      final resolved = await resolveManilaLocation(forceRefresh: forceRefresh);
      if (resolved != null) return resolved.formatted;

      final placemarks = await placemarkFromCoordinates(
        locData.latitude!,
        locData.longitude!,
      );

      if (placemarks.isNotEmpty) {
        final place = placemarks.first;

        String city = place.locality ?? "";
        String district = place.subLocality ?? "";
        String country = place.country ?? "";

        String result = "";
        if (district.isNotEmpty) result += "$district, ";
        if (city.isNotEmpty) result += city;
        if (result.isEmpty) result = country;

        return result;
      }

      return 'Unknown location';
    } catch (_) {
      return 'Location unavailable';
    }
  }

  static Future<Map<String, double>?> getCurrentCoordinates() async {
    final simulated = await DebugLocationService.getSimulatedCoordinates();
    if (simulated != null) return simulated;

    final hasPermission = await _handlePermission();
    if (!hasPermission) return null;

    try {
      final locData = await _location.getLocation();
      if (locData.latitude == null || locData.longitude == null) {
        return null;
      }

      return {
        'lat': locData.latitude!,
        'lng': locData.longitude!,
      };
    } catch (e) {
      return null;
    }
  }

  /// True when debug simulation is active (reports may proceed outside real GPS).
  static Future<bool> isUsingDebugLocation() =>
      DebugLocationService.isEnabled();
}
