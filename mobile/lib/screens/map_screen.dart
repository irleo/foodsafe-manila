import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_map_location_marker/flutter_map_location_marker.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';
import 'dart:convert';
import '../services/api_service.dart';
import '../services/manila_geo_service.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final MapController _mapController = MapController();
  bool isLoading = true;

  List<Polygon<Object>> heatmapPolygons = [];
  Map<int, Map<String, dynamic>> riskByBarangay = {};
  Map<String, dynamic> riskSummary = {
    'high': 0,
    'moderate': 0,
    'low': 0,
  };

  Color riskColor(String level, int score) {
    final intensity = (score.clamp(0, 100)) / 100.0;
    switch (level) {
      case 'high':
        return Color.lerp(Colors.orange, Colors.red, intensity) ?? Colors.red;
      case 'moderate':
        return Color.lerp(Colors.amber, Colors.orange, intensity) ?? Colors.orange;
      default:
        return Color.lerp(Colors.lightGreen, Colors.green, intensity) ?? Colors.green;
    }
  }

  @override
  void initState() {
    super.initState();
    loadHeatmap();
  }

  Future<void> loadHeatmap() async {
    await ManilaGeoService.ensureLoaded();
    final heatmap = await ApiService.getRiskHeatmap(months: '12');

    final areas = (heatmap?['areas'] as List<dynamic>? ?? [])
        .cast<Map<String, dynamic>>();
    riskByBarangay = {
      for (final area in areas)
        if (area['barangayNo'] != null)
          (area['barangayNo'] as num).toInt(): area,
    };

    final summary = heatmap?['summary'] as Map<String, dynamic>? ?? {};
    riskSummary = {
      'high': summary['high'] ?? 0,
      'moderate': summary['moderate'] ?? 0,
      'low': summary['low'] ?? 0,
    };

    final geoJsonString = await rootBundle.loadString(
      'assets/manila-barangays-with-legislative-districts.json',
    );
    final data = jsonDecode(geoJsonString);
    final polygons = <Polygon<Object>>[];

    for (var feature in data['features']) {
      try {
        final properties = feature['properties'] as Map<String, dynamic>;
        final brgyNumber = (properties['barangayNo'] as num?)?.toInt();
        if (brgyNumber == null) continue;

        final area = riskByBarangay[brgyNumber];
        final level = area?['riskLevel']?.toString() ?? 'low';
        final score = (area?['riskScore'] as num?)?.toInt() ?? 0;
        final color = riskColor(level, score);

        final geometry = feature['geometry'];
        void addPolygon(List<LatLng> points) {
          polygons.add(
            Polygon<Object>(
              points: points,
              color: color.withValues(alpha: 0.38),
              borderColor: color.withValues(alpha: 0.9),
              borderStrokeWidth: 1.2,
              hitValue: <String, dynamic>{
                ...properties,
                if (area != null) ...area,
              },
            ),
          );
        }

        if (geometry['type'] == 'Polygon') {
          final coordinates = geometry['coordinates'][0];
          final points = coordinates.map<LatLng>((coord) {
            return LatLng(coord[1].toDouble(), coord[0].toDouble());
          }).toList();
          addPolygon(points);
        } else if (geometry['type'] == 'MultiPolygon') {
          for (var polygonCoords in geometry['coordinates']) {
            final coordinates = polygonCoords[0];
            final points = coordinates.map<LatLng>((coord) {
              return LatLng(coord[1].toDouble(), coord[0].toDouble());
            }).toList();
            addPolygon(points);
          }
        }
      } catch (e) {
        debugPrint('Error parsing polygon: $e');
      }
    }

    setState(() {
      heatmapPolygons = polygons;
      isLoading = false;
    });
  }

  bool _pointInPolygon(LatLng point, List<LatLng> polygon) {
    var inside = false;
    for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      final xi = polygon[i].longitude;
      final yi = polygon[i].latitude;
      final xj = polygon[j].longitude;
      final yj = polygon[j].latitude;
      final intersect = ((yi > point.latitude) != (yj > point.latitude)) &&
          (point.longitude <
              (xj - xi) * (point.latitude - yi) / (yj - yi + 0.0) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  void _handleMapTap(TapPosition _, LatLng point) {
    for (final polygon in heatmapPolygons) {
      if (_pointInPolygon(point, polygon.points)) {
        final data = polygon.hitValue;
        if (data is Map<String, dynamic>) {
          _showAreaCard(data);
        }
        return;
      }
    }
  }

  void _showAreaCard(Map<String, dynamic> area) {
    final level = area['riskLabel']?.toString() ?? 'Low Risk';
    final color = riskColor(
      area['riskLevel']?.toString() ?? 'low',
      (area['riskScore'] as num?)?.toInt() ?? 0,
    );
    final district = area['district']?.toString() ?? '';
    final barangay = area['barangay']?.toString() ?? '';
    final barangayNo = area['barangayNo']?.toString() ?? '';
    final official = area['officialCases'] ?? area['classification']?['official'] ?? 0;
    final suspected = area['suspectedCases'] ?? area['classification']?['suspected'] ?? 0;

    showDialog(
      context: context,
      builder: (context) {
        return Dialog(
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  ManilaGeoService.formatLocation(
                    district: district,
                    locality: barangay,
                    barangayNo: int.tryParse(barangayNo) ?? 0,
                  ),
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: color),
                  ),
                  child: Text(
                    level,
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: color,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  'Risk score: ${area['riskScore'] ?? 0}',
                  style: GoogleFonts.inter(fontSize: 12),
                ),
                Text(
                  'Confirmed cases: $official',
                  style: GoogleFonts.inter(fontSize: 12, color: Colors.black54),
                ),
                Text(
                  'Suspected cases: $suspected',
                  style: GoogleFonts.inter(fontSize: 12, color: Colors.black54),
                ),
                Text(
                  'Total: ${area['totalCases'] ?? (official + suspected)}',
                  style: GoogleFonts.inter(fontSize: 12, color: Colors.black54),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        automaticallyImplyLeading: false,
        surfaceTintColor: const Color(0xFFF9FAFB),
        backgroundColor: Colors.white,
        toolbarHeight: 92,
        titleSpacing: 16,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 8),
            Text(
              'Heatmap',
              style: GoogleFonts.inter(
                fontSize: 20,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
      body: SafeArea(
        top: true,
        child: Stack(
          children: [
            isLoading
                ? const Center(
                    child: CircularProgressIndicator(
                      strokeWidth: 4,
                      color: Colors.blue,
                    ),
                  )
                : FlutterMap(
                    mapController: _mapController,
                    options: MapOptions(
                      initialCenter: const LatLng(14.5995, 120.9842),
                      initialZoom: 14,
                      maxZoom: 20,
                      onTap: _handleMapTap,
                      cameraConstraint: CameraConstraint.contain(
                        bounds: LatLngBounds(
                          const LatLng(14.50, 120.93),
                          const LatLng(14.72, 121.05),
                        ),
                      ),
                    ),
                    children: [
                      TileLayer(
                        urlTemplate:
                            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                        userAgentPackageName: 'com.example.foodsafe_manila',
                      ),
                      PolygonLayer(polygons: heatmapPolygons),
                      const CurrentLocationLayer(
                        style: LocationMarkerStyle(
                          marker: DefaultLocationMarker(),
                          markerSize: Size(20, 20),
                          markerDirection: MarkerDirection.heading,
                        ),
                      ),
                      RichAttributionWidget(
                        attributions: [
                          const TextSourceAttribution(
                            'OpenStreetMap contributors',
                          ),
                        ],
                      ),
                    ],
                  ),
            Positioned(
              left: 16,
              top: 32,
              child: _legendCard(),
            ),
            Positioned(
              left: 16,
              right: 16,
              bottom: 60,
              child: _bottomStats(
                high: '${riskSummary['high']}',
                moderate: '${riskSummary['moderate']}',
                low: '${riskSummary['low']}',
              ),
            ),
          ],
        ),
      )
    );
  }
}

Widget _legendCard() {
  return Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 6)],
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Risk Heatmap',
          style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600),
        ),
        Text(
          'Tap an area for details',
          style: GoogleFonts.inter(fontSize: 8, color: Colors.grey),
        ),
        const SizedBox(height: 4),
        const _LegendRow(label: 'High Risk', color: Colors.red),
        const _LegendRow(label: 'Moderate', color: Colors.orange),
        const _LegendRow(label: 'Low Risk', color: Colors.green),
      ],
    ),
  );
}

class _LegendRow extends StatelessWidget {
  final String label;
  final Color color;

  const _LegendRow({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 3),
      child: Row(
        children: [
          Container(
            width: 14,
            height: 14,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 8),
          Text(label, style: GoogleFonts.inter(fontSize: 10)),
        ],
      ),
    );
  }
}

Widget _bottomStats({
  required String high,
  required String moderate,
  required String low,
}) {
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: 0.9),
      borderRadius: BorderRadius.circular(40),
      boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 6)],
    ),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceAround,
      children: [
        _Stat(label: 'High Risk', value: high, color: Colors.red),
        const _Divider(),
        _Stat(label: 'Moderate Risk', value: moderate, color: Colors.orange),
        const _Divider(),
        _Stat(label: 'Low Risk', value: low, color: Colors.green),
      ],
    ),
  );
}

class _Stat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _Stat({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(label, style: GoogleFonts.inter(fontSize: 11, color: Colors.grey)),
        const SizedBox(height: 2),
        Text(
          value,
          style: GoogleFonts.inter(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
      ],
    );
  }
}

class _Divider extends StatelessWidget {
  const _Divider();

  @override
  Widget build(BuildContext context) {
    return Container(width: 1, height: 28, color: Colors.grey.shade300);
  }
}

