import 'package:geocoding/geocoding.dart';
import 'package:location/location.dart' as loc;

import 'debug_location_service.dart';
import 'manila_geo_service.dart';

class LocationService {
  static final loc.Location _location = loc.Location();

  static String? cachedAddress;
  static ManilaLocation? cachedManilaLocation;

  static bool _permissionInitialized = false;

  /// Initializes the device location service and permission.
  ///
  /// Call this once during app startup before runApp().
  static Future<bool> initializePermission() async {
    if (_permissionInitialized) {
      return true;
    }

    try {
      // Make sure the device's location service is enabled.
      var serviceEnabled = await _location.serviceEnabled();

      if (!serviceEnabled) {
        serviceEnabled = await _location.requestService();

        if (!serviceEnabled) {
          return false;
        }
      }

      // Check the current permission.
      var permission = await _location.hasPermission();

      // Request permission if it has not been granted yet.
      if (permission == loc.PermissionStatus.denied) {
        permission = await _location.requestPermission();
      }

      if (permission != loc.PermissionStatus.granted) {
        return false;
      }

      _permissionInitialized = true;
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Preloads the user's location and resolves it to a Manila barangay.
  ///
  /// Permission should already have been initialized by initializePermission().
  static Future<void> preloadLocation() async {
    final simulated = await DebugLocationService.getSimulatedLocation();

    if (simulated != null) {
      cachedManilaLocation = simulated;
      cachedAddress = simulated.formatted;
      return;
    }

    final permissionGranted = await initializePermission();

    if (!permissionGranted) {
      cachedAddress = 'Location unavailable';
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

    final permissionGranted = await initializePermission();

    if (!permissionGranted) {
      return null;
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
  }) async {
    if (cachedAddress != null && !forceRefresh) {
      return cachedAddress!;
    }

    final simulated = await DebugLocationService.getSimulatedLocation();

    if (simulated != null) {
      cachedManilaLocation = simulated;
      cachedAddress = simulated.formatted;
      return simulated.formatted;
    }

    final permissionGranted = await initializePermission();

    if (!permissionGranted) {
      return 'Location unavailable';
    }

    try {
      await ManilaGeoService.ensureLoaded();

      final locationData = await _location.getLocation();

      final lat = locationData.latitude;
      final lng = locationData.longitude;

      if (lat == null || lng == null) {
        return 'Location unavailable';
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
      return 'Location unavailable';
    }
  }

  static Future<Map<String, double>?> getCurrentCoordinates() async {
    final simulated = await DebugLocationService.getSimulatedCoordinates();

    if (simulated != null) {
      return simulated;
    }

    final permissionGranted = await initializePermission();

    if (!permissionGranted) {
      return null;
    }

    try {
      final locationData = await _location.getLocation();

      final lat = locationData.latitude;
      final lng = locationData.longitude;

      if (lat == null || lng == null) {
        return null;
      }

      return {
        'lat': lat,
        'lng': lng,
      };
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
        return 'Location unavailable';
      }

      return await _getPlacemarkAddress(lat, lng);
    } catch (_) {
      return 'Location unavailable';
    }
  }

  static Future<String> _getPlacemarkAddress(
    double latitude,
    double longitude,
  ) async {
    try {
      final placemarks = await placemarkFromCoordinates(
        latitude,
        longitude,
      );

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
      return 'Location unavailable';
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