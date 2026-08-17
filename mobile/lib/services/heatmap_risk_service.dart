import '../services/api_service.dart';
import '../utils/dashboard_reference_period.dart';
import '../utils/heatmap_case_builders.dart';

/// District heatmap risk stats — same source and logic as the Map (Heatmap) screen.
class HeatmapRiskService {
  HeatmapRiskService._();
  static final HeatmapRiskService instance = HeatmapRiskService._();

  String? _datasetId;
  Map<String, dynamic>? _cachedDataset;

  Future<HeatmapRiskSnapshot> load({
    String selectedYear = 'All',
    String selectedMonth = 'All',
    String selectedDisease = 'All',
    String selectedCaseClassification = 'confirmed',
  }) async {
    try {
      _cachedDataset ??= await ApiService.fetchLatestValidatedDataset();
      _datasetId ??= _cachedDataset?['id']?.toString();

      if (_datasetId == null) {
        return HeatmapRiskSnapshot.error('No validated dataset available.');
      }

      final heatmapData = await ApiService.fetchDistrictHeatmap(
        datasetId: _datasetId!,
        selectedYear: selectedYear,
        selectedMonth: selectedMonth,
        selectedDisease: selectedDisease,
        selectedCaseClassification: selectedCaseClassification,
      );

      final caseRows = await ApiService.fetchOfficialCasesByDataset(_datasetId!);

      final stats = (heatmapData?['districtStats'] as List<dynamic>? ?? [])
          .cast<Map<String, dynamic>>();

      final referencePeriod = DashboardReferencePeriod.format({
        'coverageStart': _cachedDataset?['coverageStart'],
        'coverageEnd': _cachedDataset?['coverageEnd'],
      });

      return HeatmapRiskSnapshot(
        riskStats: HeatmapCaseBuilders.buildRiskStatsFromDistrictPoints(stats),
        topDistricts: HeatmapCaseBuilders.buildTopDistrictsFromPoints(
          stats,
          limit: 3,
        ),
        topDiseases: HeatmapCaseBuilders.buildTopDiseasesFromCases(
          caseRows,
          limit: 3,
        ),
        dashboardSummary: HeatmapCaseBuilders.buildDashboardSummaryFromCases(
          caseRows,
        ),
        referencePeriod: referencePeriod,
      );
    } catch (_) {
      return HeatmapRiskSnapshot.error('Failed to load heatmap data.');
    }
  }

  void clearCache() {
    _datasetId = null;
    _cachedDataset = null;
  }
}

class HeatmapRiskSnapshot {
  final Map<String, int> riskStats;
  final List<Map<String, dynamic>> topDistricts;
  final List<Map<String, dynamic>> topDiseases;
  final Map<String, dynamic>? dashboardSummary;
  final String? referencePeriod;
  final String? error;

  const HeatmapRiskSnapshot({
    this.riskStats = const {},
    this.topDistricts = const [],
    this.topDiseases = const [],
    this.dashboardSummary,
    this.referencePeriod,
    this.error,
  });

  factory HeatmapRiskSnapshot.error(String message) {
    return HeatmapRiskSnapshot(error: message);
  }

  bool get hasError => error != null;
}
