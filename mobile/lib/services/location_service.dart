import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart' show Geolocator;
import 'package:location/location.dart' as loc;

import 'package:foodsafe_manila/services/debug_location_service.dart';
import 'package:foodsafe_manila/services/manila_geo_service.dart';

enum LocationAccessStatus {
  unknown,
  serviceDisabled,
  permissionDenied,
  permissionDeniedForever,
  granted,
}

class LocationService {
  static final loc.Location _location = loc.Location();

  static String? cachedAddress;
  static ManilaLocation? cachedManilaLocation;
  static LocationAccessStatus _accessStatus = LocationAccessStatus.unknown;

  static bool get needsPermission =>
      _accessStatus == LocationAccessStatus.permissionDenied ||
      _accessStatus == LocationAccessStatus.permissionDeniedForever;

  static String get unavailableMessage => 'Location unavailable';

  static void clearCachedLocation() {
    cachedAddress = null;
    cachedManilaLocation = null;
  }

  /// Rechecks phone permission on each access so grants and revocations apply.
  static Future<bool> initializePermission({
    bool requestIfDenied = true,
  }) async {
    try {
      // Make sure the device's location service is enabled.
      var serviceEnabled = await _location.serviceEnabled();

      if (!serviceEnabled && requestIfDenied) {
        serviceEnabled = await _location.requestService();

        if (!serviceEnabled) {
          _accessStatus = LocationAccessStatus.serviceDisabled;
          clearCachedLocation();
          return false;
        }
      }
      if (!serviceEnabled) {
        _accessStatus = LocationAccessStatus.serviceDisabled;
        clearCachedLocation();
        return false;
      }

      // Check the current permission.
      var permission = await _location.hasPermission();

      // Request permission if it has not been granted yet.
      if (permission == loc.PermissionStatus.denied && requestIfDenied) {
        permission = await _location.requestPermission();
      }

      if (permission != loc.PermissionStatus.granted &&
          permission != loc.PermissionStatus.grantedLimited) {
        _accessStatus = permission == loc.PermissionStatus.deniedForever
            ? LocationAccessStatus.permissionDeniedForever
            : LocationAccessStatus.permissionDenied;
        clearCachedLocation();
        return false;
      }

      _accessStatus = LocationAccessStatus.granted;
      return true;
    } catch (_) {
      _accessStatus = LocationAccessStatus.unknown;
      clearCachedLocation();
      return false;
    }
  }

  static Future<bool> openPermissionSettings() => Geolocator.openAppSettings();

  /// Preloads the user's location and resolves it to a Manila barangay.
  ///
  /// Permission should already have been initialized by initializePermission().
  static Future<void> preloadLocation() async {
    if (!await initializePermission()) return;
    final simulated = await DebugLocationService.getSimulatedLocation();

    if (simulated != null) {
      cachedManilaLocation = simulated;
      cachedAddress = simulated.formatted;
      return;
    }

    final resolved = await resolveManilaLocation();

    if (resolved != null) {
      cachedManilaLocation = resolved;
      cachedAddress = resolved.formatted;
      return;
    }

    cachedAddress = await _getFallbackAddress();
  }

  static Future<ManilaLocation?> resolveManilaLocation({
    bool forceRefresh = false,
    bool requestIfDenied = true,
  }) async {
    if (!await initializePermission(requestIfDenied: requestIfDenied)) {
      return null;
    }
    if (cachedManilaLocation != null && !forceRefresh) {
      return cachedManilaLocation;
    }

    final simulated = await DebugLocationService.getSimulatedLocation();

    if (simulated != null) {
      cachedManilaLocation = simulated;
      cachedAddress = simulated.formatted;
      return simulated;
    }

    try {
      await ManilaGeoService.ensureLoaded();

      final locationData = await _location.getLocation();

      final lat = locationData.latitude;
      final lng = locationData.longitude;

      if (lat == null || lng == null) {
        return null;
      }

      final resolved = ManilaGeoService.lookup(lat, lng);

      cachedManilaLocation = resolved;

      if (resolved != null) {
        cachedAddress = resolved.formatted;
      }

      return resolved;
    } catch (_) {
      return null;
    }
  }

  static Future<String> getUserAddress({
    bool forceRefresh = false,
    bool requestIfDenied = true,
  }) async {
    if (!await initializePermission(requestIfDenied: requestIfDenied)) {
      return unavailableMessage;
    }
    if (cachedAddress != null && !forceRefresh) {
      return cachedAddress!;
    }

    final simulated = await DebugLocationService.getSimulatedLocation();

    if (simulated != null) {
      cachedManilaLocation = simulated;
      cachedAddress = simulated.formatted;
      return simulated.formatted;
    }

    try {
      await ManilaGeoService.ensureLoaded();

      final locationData = await _location.getLocation();

      final lat = locationData.latitude;
      final lng = locationData.longitude;

      if (lat == null || lng == null) {
        return unavailableMessage;
      }

      final resolved = ManilaGeoService.lookup(lat, lng);

      if (resolved != null) {
        cachedManilaLocation = resolved;
        cachedAddress = resolved.formatted;
        return resolved.formatted;
      }

      final fallback = await _getPlacemarkAddress(lat, lng);

      cachedAddress = fallback;

      return fallback;
    } catch (_) {
      return unavailableMessage;
    }
  }

  static Future<Map<String, double>?> getCurrentCoordinates() async {
    if (!await initializePermission()) return null;
    final simulated = await DebugLocationService.getSimulatedCoordinates();

    if (simulated != null) {
      return simulated;
    }

    try {
      final locationData = await _location.getLocation();

      final lat = locationData.latitude;
      final lng = locationData.longitude;

      if (lat == null || lng == null) {
        return null;
      }

      return {'lat': lat, 'lng': lng};
    } catch (_) {
      return null;
    }
  }

  static Future<String> _getFallbackAddress() async {
    try {
      final locationData = await _location.getLocation();

      final lat = locationData.latitude;
      final lng = locationData.longitude;

      if (lat == null || lng == null) {
        return unavailableMessage;
      }

      return await _getPlacemarkAddress(lat, lng);
    } catch (_) {
      return unavailableMessage;
    }
  }

  static Future<String> _getPlacemarkAddress(
    double latitude,
    double longitude,
  ) async {
    try {
      final placemarks = await placemarkFromCoordinates(latitude, longitude);

      if (placemarks.isEmpty) {
        return 'Unknown location';
      }

      final place = placemarks.first;

      final city = place.locality ?? '';
      final district = place.subLocality ?? '';
      final country = place.country ?? '';

      String result = '';

      if (district.isNotEmpty) {
        result += '$district, ';
      }

      if (city.isNotEmpty) {
        result += city;
      }

      if (result.isEmpty) {
        result = country;
      }

      return result.isEmpty ? 'Unknown location' : result;
    } catch (_) {
      return unavailableMessage;
    }
  }

  static Future<void> clearCache() async {
    cachedAddress = null;
    cachedManilaLocation = null;
  }

  /// True when debug simulation is active.
  static Future<bool> isUsingDebugLocation() {
    return DebugLocationService.isEnabled();
  }
}
