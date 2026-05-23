import 'dart:convert';
import 'package:flutter/services.dart' show rootBundle;

class ManilaLocation {
  final String district;
  final String barangay;
  final int barangayNo;
  final String formatted;

  const ManilaLocation({
    required this.district,
    required this.barangay,
    required this.barangayNo,
    required this.formatted,
  });

  Map<String, dynamic> toPayload({String? localityName}) {
    final middle = localityName?.trim().isNotEmpty == true
        ? localityName!.trim()
        : ManilaGeoService._displayBarangayName(barangay);
    return {
      'district': district,
      'barangay': middle,
      'barangayNo': barangayNo,
      'name': ManilaGeoService.formatLocation(
        district: district,
        locality: middle,
        barangayNo: barangayNo,
      ),
    };
  }
}

class ManilaGeoService {
  static List<Map<String, dynamic>>? _features;

  static Future<void> ensureLoaded() async {
    if (_features != null) return;
    final raw = await rootBundle.loadString(
      'assets/manila-barangays-with-legislative-districts.json',
    );
    final data = json.decode(raw) as Map<String, dynamic>;
    _features = (data['features'] as List).cast<Map<String, dynamic>>();
  }

  static String formatLocation({
    required String district,
    required String locality,
    required int barangayNo,
  }) {
    return '$district, $locality';
  }

  static String _displayBarangayName(String barangay) {
    final trimmed = barangay.trim();
    final match = RegExp(r'^Barangay\s+', caseSensitive: false).firstMatch(trimmed);
    if (match != null) return trimmed.substring(match.end).trim();
    return trimmed;
  }

  static bool _pointInPolygon(double x, double y, List<List<double>> polygon) {
    var inside = false;
    for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      final xi = polygon[i][0];
      final yi = polygon[i][1];
      final xj = polygon[j][0];
      final yj = polygon[j][1];
      final intersect =
          ((yi > y) != (yj > y)) &&
          (x < (xj - xi) * (y - yi) / (yj - yi + 0.0) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  static ManilaLocation? lookup(double lat, double lng, {String? localityName}) {
    if (_features == null) return null;

    for (final feature in _features!) {
      final geometry = feature['geometry'] as Map<String, dynamic>?;
      if (geometry == null) continue;

      final type = geometry['type'];
      final coordinates = geometry['coordinates'];

      bool hit = false;
      if (type == 'Polygon') {
        for (final ring in coordinates as List) {
          final polygon = (ring as List).map<List<double>>((point) {
            return [
              (point[0] as num).toDouble(),
              (point[1] as num).toDouble(),
            ];
          }).toList();
          if (_pointInPolygon(lng, lat, polygon)) {
            hit = true;
            break;
          }
        }
      } else if (type == 'MultiPolygon') {
        for (final polygonGroup in coordinates as List) {
          for (final ring in polygonGroup) {
            final polygon = (ring as List).map<List<double>>((point) {
              return [
                (point[0] as num).toDouble(),
                (point[1] as num).toDouble(),
              ];
            }).toList();
            if (_pointInPolygon(lng, lat, polygon)) {
              hit = true;
              break;
            }
          }
          if (hit) break;
        }
      }

      if (!hit) continue;

      final props = feature['properties'] as Map<String, dynamic>;
      final district = props['district']?.toString() ?? 'District 1';
      final barangay = props['barangay']?.toString() ?? 'Unknown';
      final barangayNo = (props['barangayNo'] as num?)?.toInt() ?? 0;
      if (barangayNo <= 0) continue;

      final middle = localityName?.trim().isNotEmpty == true
          ? localityName!.trim()
          : _displayBarangayName(barangay);

      return ManilaLocation(
        district: district,
        barangay: barangay,
        barangayNo: barangayNo,
        formatted: formatLocation(
          district: district,
          locality: middle,
          barangayNo: barangayNo,
        ),
      );
    }

    return null;
  }

  static List<Map<String, dynamic>> barangaysForDistrict(String district) {
    if (_features == null) return [];

    final list = <Map<String, dynamic>>[];
    for (final feature in _features!) {
      final props = feature['properties'] as Map<String, dynamic>;
      if (props['district']?.toString() != district) continue;
      final barangayNo = (props['barangayNo'] as num?)?.toInt();
      if (barangayNo == null) continue;
      list.add({
        'barangay': props['barangay']?.toString() ?? 'Barangay $barangayNo',
        'barangayNo': barangayNo,
        'label': 'Barangay $barangayNo',
      });
    }

    list.sort((a, b) => (a['barangayNo'] as int).compareTo(b['barangayNo'] as int));
    return list;
  }

  static String districtFromUiValue(String value) {
    if (value == 'all') return 'all';
    final match = RegExp(r'(\d+)').firstMatch(value);
    if (match != null) return 'District ${match.group(1)}';
    return value;
  }
}
