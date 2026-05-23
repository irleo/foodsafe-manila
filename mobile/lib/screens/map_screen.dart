import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_map_location_marker/flutter_map_location_marker.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'dart:convert';

import '../services/api_service.dart';
import '../services/manila_geo_service.dart';
import '../utils/heatmap_case_builders.dart';
import '../widgets/constrained_dropdown.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => MapScreenState();
}

class MapScreenState extends State<MapScreen> {
  final MapController _mapController = MapController();

  bool isLoading = true;
  String? errorMsg;
  String? datasetId;

  List<Map<String, dynamic>> districtPoints = [];
  List<Map<String, dynamic>> districtStats = [];
  Map<String, dynamic> filterOptions = {};

  List<Polygon<Object>> heatmapPolygons = [];
  Map<int, Map<String, dynamic>> casesByBarangay = {};

  Map<String, int> riskStats = {
    'Low': 0,
    'Medium': 0,
    'High': 0,
    'Critical': 0,
  };
  List<Map<String, dynamic>> topDistricts = [];

  String selectedYear = 'All';
  String selectedMonth = 'All';
  String selectedDisease = 'All';
  String selectedCaseClassification = 'All';

  static const _manilaCenter = LatLng(14.5995, 120.9842);
  static final _manilaBounds = LatLngBounds(
    const LatLng(14.53, 120.93),
    const LatLng(14.7, 121.05),
  );

  static const _monthOptions = [
    (value: '1', label: 'Jan'),
    (value: '2', label: 'Feb'),
    (value: '3', label: 'Mar'),
    (value: '4', label: 'Apr'),
    (value: '5', label: 'May'),
    (value: '6', label: 'Jun'),
    (value: '7', label: 'Jul'),
    (value: '8', label: 'Aug'),
    (value: '9', label: 'Sep'),
    (value: '10', label: 'Oct'),
    (value: '11', label: 'Nov'),
    (value: '12', label: 'Dec'),
  ];

  @override
  void initState() {
    super.initState();
    loadHeatmap();
  }

  Future<void> refreshData() => loadHeatmap();

  List<String> get _yearOptions {
    final years =
        (filterOptions['years'] as List<dynamic>? ?? [])
            .map((y) => num.tryParse('$y'))
            .whereType<num>()
            .map((y) => y.toInt())
            .toSet()
            .toList()
          ..sort();
    return ['All', ...years.map((y) => '$y')];
  }

  List<String> get _diseaseOptions {
    final diseases =
        (filterOptions['diseases'] as List<dynamic>? ?? [])
            .map((d) => d?.toString())
            .where((d) => d != null && d.isNotEmpty)
            .cast<String>()
            .toList()
          ..sort();
    return ['All', ...diseases];
  }

  List<String> get _classificationOptions {
    final classes =
        (filterOptions['caseClassifications'] as List<dynamic>? ?? [])
            .map((c) => c?.toString())
            .where((c) => c != null && c.isNotEmpty)
            .cast<String>()
            .toList()
          ..sort();
    return ['All', ...classes];
  }

  List<String> get _monthOptionValues => [
    'All',
    ..._monthOptions.map((m) => m.value),
  ];

  bool get showNoData {
    final hasActiveFilter =
        selectedYear != 'All' ||
        selectedMonth != 'All' ||
        selectedDisease != 'All' ||
        selectedCaseClassification != 'All';
    return hasActiveFilter && districtPoints.isEmpty;
  }

  Future<void> loadHeatmap() async {
    if (!mounted) return;
    setState(() {
      isLoading = true;
      errorMsg = null;
    });

    try {
      datasetId ??= await ApiService.fetchLatestValidatedDatasetId();
      if (datasetId == null) {
        if (!mounted) return;
        setState(() {
          isLoading = false;
          errorMsg = 'No validated dataset available.';
          districtPoints = [];
          districtStats = [];
          heatmapPolygons = [];
        });
        return;
      }

      final data = await ApiService.fetchDistrictHeatmap(
        datasetId: datasetId!,
        selectedYear: selectedYear,
        selectedMonth: selectedMonth,
        selectedDisease: selectedDisease,
        selectedCaseClassification: selectedCaseClassification,
      );

      if (!mounted) return;

      final points = (data?['points'] as List<dynamic>? ?? [])
          .cast<Map<String, dynamic>>();
      final stats = (data?['districtStats'] as List<dynamic>? ?? [])
          .cast<Map<String, dynamic>>();
      final options = data?['filterOptions'] as Map<String, dynamic>? ?? {};

      casesByBarangay = {
        for (final p in points)
          if (p['barangayNo'] != null) (p['barangayNo'] as num).toInt(): p,
      };

      districtPoints = points;
      districtStats = stats;
      filterOptions = options;
      riskStats = HeatmapCaseBuilders.buildRiskStatsFromDistrictPoints(stats);
      topDistricts = HeatmapCaseBuilders.buildTopDistrictsFromPoints(
        stats,
        limit: 5,
      );

      await _buildPolygons();

      if (!mounted) return;
      setState(() => isLoading = false);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        isLoading = false;
        errorMsg = 'Failed to load heatmap data.';
        districtPoints = [];
        districtStats = [];
        heatmapPolygons = [];
      });
    }
  }

  Future<void> _buildPolygons() async {
    await ManilaGeoService.ensureLoaded();

    final geoJsonString = await rootBundle.loadString(
      'assets/manila-barangays-with-legislative-districts.json',
    );
    final data = jsonDecode(geoJsonString);
    final polygons = <Polygon<Object>>[];

    for (final feature in data['features'] as List<dynamic>) {
      try {
        final properties = feature['properties'] as Map<String, dynamic>;
        final barangayNo = (properties['barangayNo'] as num?)?.toInt();
        if (barangayNo == null) continue;

        final point = casesByBarangay[barangayNo];
        final cases = (point?['cases'] as num?)?.toInt() ?? 0;
        final hasCases = cases > 0;
        final avgIncident =
            (point?['districtAvgIncident'] as num?)?.toDouble() ?? 0;
        final fillColor = hasCases
            ? HeatmapCaseBuilders.getRiskColor(avgIncident)
            : const Color(0xFFCBD5E1);
        final borderColor = hasCases
            ? const Color(0xFF334166)
            : const Color(0xFFCBD5E1);

        void addPolygon(List<LatLng> points) {
          polygons.add(
            Polygon<Object>(
              points: points,
              color: fillColor.withValues(alpha: hasCases ? 0.75 : 0.12),
              borderColor: borderColor.withValues(alpha: hasCases ? 0.7 : 0.35),
              borderStrokeWidth: hasCases ? 0.5 : 0.35,
              hitValue: <String, dynamic>{
                ...properties,
                if (point != null) ...point,
              },
            ),
          );
        }

        final geometry = feature['geometry'] as Map<String, dynamic>;
        if (geometry['type'] == 'Polygon') {
          final coordinates = geometry['coordinates'][0] as List<dynamic>;
          final points = coordinates
              .map<LatLng>(
                (coord) => LatLng(
                  (coord[1] as num).toDouble(),
                  (coord[0] as num).toDouble(),
                ),
              )
              .toList();
          addPolygon(points);
        } else if (geometry['type'] == 'MultiPolygon') {
          for (final polygonCoords
              in geometry['coordinates'] as List<dynamic>) {
            final coordinates = polygonCoords[0] as List<dynamic>;
            final points = coordinates
                .map<LatLng>(
                  (coord) => LatLng(
                    (coord[1] as num).toDouble(),
                    (coord[0] as num).toDouble(),
                  ),
                )
                .toList();
            addPolygon(points);
          }
        }
      } catch (e) {
        debugPrint('Error parsing polygon: $e');
      }
    }

    heatmapPolygons = polygons;
  }

  void _onFilterChanged(void Function() update) {
    setState(update);
    loadHeatmap();
  }

  bool _pointInPolygon(LatLng point, List<LatLng> polygon) {
    var inside = false;
    for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      final xi = polygon[i].longitude;
      final yi = polygon[i].latitude;
      final xj = polygon[j].longitude;
      final yj = polygon[j].latitude;
      final intersect =
          ((yi > point.latitude) != (yj > point.latitude)) &&
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
          final cases = (data['cases'] as num?)?.toInt() ?? 0;
          if (cases > 0) _showBarangayPopup(data);
        }
        return;
      }
    }
  }

  void _showBarangayPopup(Map<String, dynamic> point) {
    final barangay = point['barangay']?.toString() ?? '';
    final district = point['district']?.toString() ?? '';
    final cases = point['cases'] ?? 0;
    final districtTotal = point['districtTotalCases'] ?? 0;
    final avgIncident = (point['districtAvgIncident'] as num?)?.toDouble() ?? 0;
    final risk = point['risk']?.toString() ?? 'No data';
    final riskColor = HeatmapCaseBuilders.getRiskColor(avgIncident);

    showDialog(
      context: context,
      builder: (context) {
        return Dialog(
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      height: 36,
                      width: 36,
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: riskColor.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        LucideIcons.triangleAlert,
                        size: 20,
                        color: riskColor,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              barangay,
                              style: GoogleFonts.inter(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: riskColor.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(color: riskColor),
                              ),
                              child: Text(
                                risk,
                                style: GoogleFonts.inter(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                  color: riskColor,
                                ),
                              ),
                            ),
                          ],
                        ),
                        Text(
                          district,
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            color: Colors.black45,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: _popupCard('Barangay Cases', '$cases', riskColor),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _popupCard(
                        'District total cases',
                        '$districtTotal',
                        riskColor,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _popupCard(
                        'District avg incident',
                        avgIncident.toStringAsFixed(2),
                        riskColor,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _popupCard(String label, String value, Color color) {
    return Container(
      padding: EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: GoogleFonts.inter(
              fontSize: 8,
              fontWeight: FontWeight.w700,
              color: Colors.black38,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 16,
              fontWeight: FontWeight.w900,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  String _formatFilterItem(String item, String label) {
    if (item == 'All') {
      switch (label) {
        case 'Year':
          return 'All';
        case 'Month':
          return 'All';
        case 'Disease':
          return 'All';
        case 'Classification':
          return 'All';
        default:
          return 'All';
      }
    }
    if (label == 'Month') {
      final match = _monthOptions.where((m) => m.value == item);
      if (match.isNotEmpty) return match.first.label;
    }
    return item[0].toUpperCase() + item.substring(1).toLowerCase();
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
            Text(
              'Heatmap',
              style: GoogleFonts.inter(
                fontSize: 20,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        actions: [
          Builder(
            builder: (context) => IconButton(
              icon: const Icon(LucideIcons.info),
              onPressed: () => Scaffold.of(context).openEndDrawer(),
            ),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(36),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Row(
              children: [
                Expanded(
                  child: ConstrainedDropdown(
                    label: 'Year',
                    value: _yearOptions.contains(selectedYear)
                        ? selectedYear
                        : 'All',
                    items: _yearOptions,
                    formatItem: _formatFilterItem,
                    onChanged: (value) {
                      if (value == null) return;
                      _onFilterChanged(() => selectedYear = value);
                    },
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ConstrainedDropdown(
                    label: 'Month',
                    value: _monthOptionValues.contains(selectedMonth)
                        ? selectedMonth
                        : 'All',
                    items: _monthOptionValues,
                    formatItem: _formatFilterItem,
                    onChanged: (value) {
                      if (value == null) return;
                      _onFilterChanged(() => selectedMonth = value);
                    },
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ConstrainedDropdown(
                    label: 'Disease',
                    value: _diseaseOptions.contains(selectedDisease)
                        ? selectedDisease
                        : 'All',
                    items: _diseaseOptions.isEmpty
                        ? const ['All']
                        : _diseaseOptions,
                    formatItem: _formatFilterItem,
                    onChanged: (value) {
                      if (value == null) return;
                      _onFilterChanged(() => selectedDisease = value);
                    },
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ConstrainedDropdown(
                    label: 'Classification',
                    value:
                        _classificationOptions.contains(
                          selectedCaseClassification,
                        )
                        ? selectedCaseClassification
                        : 'All',
                    items: _classificationOptions.isEmpty
                        ? const ['All', 'confirmed', 'suspected', 'probable']
                        : _classificationOptions,
                    formatItem: _formatFilterItem,
                    onChanged: (value) {
                      if (value == null) return;
                      _onFilterChanged(
                        () => selectedCaseClassification = value,
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      endDrawer: Drawer(
        backgroundColor: const Color(0xFFF9FAFB),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _sectionTitle('Legend'),
                const SizedBox(height: 12),
                _legendItem(
                  const Color(0xFF22C55E),
                  'Low Risk',
                  '0–5 avg incidents',
                ),
                const SizedBox(height: 8),
                _legendItem(
                  const Color(0xFFEAB308),
                  'Medium Risk',
                  '6–15 avg incidents',
                ),
                const SizedBox(height: 8),
                _legendItem(
                  const Color(0xFFF97316),
                  'High Risk',
                  '16–30 avg incidents',
                ),
                const SizedBox(height: 8),
                _legendItem(
                  const Color(0xFFEF4444),
                  'Critical Risk',
                  '31+ avg incidents',
                ),
                const SizedBox(height: 24),
                _sectionTitle('Top Districts'),
                const SizedBox(height: 12),
                if (topDistricts.isEmpty)
                  Text(
                    'No data available.',
                    style: GoogleFonts.inter(fontSize: 12, color: Colors.grey),
                  )
                else
                  ...topDistricts.asMap().entries.map((entry) {
                    final index = entry.key + 1;
                    final item = entry.value;
                    final name = item['name']?.toString() ?? '';
                    final cases = item['cases'] ?? 0;
                    return _districtItem(name, cases, index);
                  }),
              ],
            ),
          ),
        ),
      ),
      body: SafeArea(
        top: true,
        child: Column(
          children: [
            Expanded(
              child: Stack(
                children: [
                  FlutterMap(
                    mapController: _mapController,
                    options: MapOptions(
                      initialCenter: _manilaCenter,
                      initialZoom: 13,
                      minZoom: 13,
                      maxZoom: 14.5,
                      onTap: _handleMapTap,
                      cameraConstraint: CameraConstraint.contain(
                        bounds: _manilaBounds,
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
                  if (isLoading)
                    Container(
                      color: Colors.white.withValues(alpha: 0.6),
                      child: Center(
                        child: Text(
                          'Loading heatmap…',
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            color: Colors.black87,
                          ),
                        ),
                      ),
                    ),
                  if (errorMsg != null)
                    Container(
                      width: double.infinity,
                      margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFFBEB),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFFDE68A)),
                      ),
                      child: Text(
                        errorMsg!,
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          color: const Color(0xFF92400E),
                        ),
                      ),
                    ),
                  Positioned(
                    left: 16,
                    right: 16,
                    bottom: 50,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        vertical: 10,
                        horizontal: 10,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.95),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: Colors.grey.shade300),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: _statCard(
                              'Low',
                              riskStats['Low'] ?? 0,
                              const Color(0xFF22C55E),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _statCard(
                              'Medium',
                              riskStats['Medium'] ?? 0,
                              const Color(0xFFEAB308),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _statCard(
                              'High',
                              riskStats['High'] ?? 0,
                              const Color(0xFFF97316),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _statCard(
                              'Critical',
                              riskStats['Critical'] ?? 0,
                              const Color(0xFFEF4444),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (showNoData)
                    Positioned(
                      top: 12,
                      left: 12,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.95),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.grey.shade300),
                        ),
                        child: Text(
                          'No matching data for the selected filter.',
                          style: GoogleFonts.inter(fontSize: 12),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _statCard(String label, int value, Color valueColor) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        children: [
          Text(
            '$label Risk',
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(fontSize: 9, color: Colors.black54),
          ),
          const SizedBox(height: 4),
          Text(
            '$value',
            style: GoogleFonts.inter(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: valueColor,
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionTitle(String title) {
    return Text(
      title.toUpperCase(),
      style: GoogleFonts.inter(
        fontSize: 10,
        fontWeight: FontWeight.bold,
        letterSpacing: 1.2,
        color: Colors.grey,
      ),
    );
  }

  Widget _legendItem(Color color, String title, String subtitle) {
    return Row(
      children: [
        Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
            Text(
              subtitle,
              style: GoogleFonts.inter(fontSize: 10, color: Colors.grey),
            ),
          ],
        ),
      ],
    );
  }

  Widget _districtItem(String district, num cases, int rank) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade200),
        borderRadius: BorderRadius.circular(14),
        color: Colors.white,
      ),
      child: Row(
        children: [
          Text(
            '#$rank',
            style: GoogleFonts.inter(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              color: Colors.grey,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              district,
              style: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: const Color(0xFFFEE2E2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              '$cases',
              style: GoogleFonts.inter(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: const Color(0xFFDC2626),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
