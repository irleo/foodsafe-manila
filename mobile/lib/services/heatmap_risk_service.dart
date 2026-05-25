import '../services/api_service.dart';
import '../utils/heatmap_case_builders.dart';

/// District heatmap risk stats — same source and logic as the Map (Heatmap) screen.
class HeatmapRiskService {
  HeatmapRiskService._();
  static final HeatmapRiskService instance = HeatmapRiskService._();

  String? _datasetId;

  Future<HeatmapRiskSnapshot> load({
    String selectedYear = 'All',
    String selectedMonth = 'All',
    String selectedDisease = 'All',
    String selectedCaseClassification = 'All',
  }) async {
    try {
      _datasetId ??= await ApiService.fetchLatestValidatedDatasetId();
      if (_datasetId == null) {
        return HeatmapRiskSnapshot.error('No validated dataset available.');
      }

      final data = await ApiService.fetchDistrictHeatmap(
        datasetId: _datasetId!,
        selectedYear: selectedYear,
        selectedMonth: selectedMonth,
        selectedDisease: selectedDisease,
        selectedCaseClassification: selectedCaseClassification,
      );

      final stats = (data?['districtStats'] as List<dynamic>? ?? [])
          .cast<Map<String, dynamic>>();

      return HeatmapRiskSnapshot(
        riskStats: HeatmapCaseBuilders.buildRiskStatsFromDistrictPoints(stats),
        topDistricts: HeatmapCaseBuilders.buildTopDistrictsFromPoints(
          stats,
          limit: 5,
        ),
      );
    } catch (_) {
      return HeatmapRiskSnapshot.error('Failed to load heatmap data.');
    }
  }

  void clearCache() => _datasetId = null;
}

class HeatmapRiskSnapshot {
  final Map<String, int> riskStats;
  final List<Map<String, dynamic>> topDistricts;
  final String? error;

  const HeatmapRiskSnapshot({
    this.riskStats = const {},
    this.topDistricts = const [],
    this.error,
  });

  factory HeatmapRiskSnapshot.error(String message) {
    return HeatmapRiskSnapshot(error: message);
  }

  bool get hasError => error != null;
}
