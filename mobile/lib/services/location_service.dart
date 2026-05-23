import 'package:geocoding/geocoding.dart';
import 'package:location/location.dart' as loc;
import 'manila_geo_service.dart';

class LocationService {
  static final loc.Location _location = loc.Location();
  static String? cachedAddress;
  static ManilaLocation? cachedManilaLocation;

  static Future<void> preloadLocation() async {
    await ManilaGeoService.ensureLoaded();
    cachedAddress = await getUserAddress();
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

    final hasPermission = await _handlePermission();
    if (!hasPermission) return null;

    try {
      await ManilaGeoService.ensureLoaded();
      final locData = await _location.getLocation();
      if (locData.latitude == null || locData.longitude == null) return null;

      String locality = '';
      try {
        final placemarks = await placemarkFromCoordinates(
          locData.latitude!,
          locData.longitude!,
        );
        if (placemarks.isNotEmpty) {
          final place = placemarks.first;
          locality = place.subLocality?.trim().isNotEmpty == true
              ? place.subLocality!.trim()
              : (place.locality ?? place.subAdministrativeArea ?? '').trim();
        }
      } catch (_) {}

      final resolved = ManilaGeoService.lookup(
        locData.latitude!,
        locData.longitude!,
        localityName: locality,
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

    final hasPermission = await _handlePermission();
    if (!hasPermission) return 'Location unavailable';

    try {
      final locData = await _location.getLocation();
      if (locData.latitude == null || locData.longitude == null) {
        return 'Location unavailable';
      }

      // Try Manila structured first
      final resolved = await resolveManilaLocation(forceRefresh: forceRefresh);
      if (resolved != null) return resolved.formatted;

      // ✅ Fallback: general geocoding (outside Manila)
      final placemarks = await placemarkFromCoordinates(
        locData.latitude!,
        locData.longitude!,
      );

      if (placemarks.isNotEmpty) {
        final place = placemarks.first;

        final city = place.locality ?? place.subAdministrativeArea ?? 'Unknown City';
        final area = place.subLocality ?? place.thoroughfare ?? 'Unknown Area';

        // Fake a barangay-like label for consistency
        return '$city, $area';
      }

      return 'Unknown location';
    } catch (_) {
      return 'Location unavailable';
    }
  }

  static Future<Map<String, double>?> getCurrentCoordinates() async {
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
}
