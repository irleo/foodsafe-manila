import 'package:intl/intl.dart';

import '../services/api_service.dart';
import '../services/risk_alert_service.dart';
import '../utils/format_helpers.dart';
import '../utils/heatmap_case_builders.dart';
import '../widgets/alerts_widgets.dart';

/// Shared alert data used by Home and Alerts screens.
/// Uses the same validated-dataset district heatmap as [MapScreen].
class AlertsRepository {
  AlertsRepository._();
  static final AlertsRepository instance = AlertsRepository._();

  static RiskLevel levelFromString(String? level) {
    switch (level) {
      case 'critical':
        return RiskLevel.critical;
      case 'high':
        return RiskLevel.high;
      case 'moderate':
      case 'medium':
        return RiskLevel.moderate;
      default:
        return RiskLevel.low;
    }
  }

  static RiskLevel levelFromHeatmapBand(String? band) {
    switch (band) {
      case 'Critical':
        return RiskLevel.critical;
      case 'High':
        return RiskLevel.high;
      case 'Medium':
        return RiskLevel.moderate;
      default:
        return RiskLevel.low;
    }
  }

  static String riskLabel(RiskLevel level) {
    switch (level) {
      case RiskLevel.critical:
        return 'Critical';
      case RiskLevel.high:
        return 'High Risk';
      case RiskLevel.moderate:
        return 'Moderate Risk';
      case RiskLevel.low:
        return 'Low Risk';
    }
  }

  static String? _formatDatasetCoverage(Map<String, dynamic>? dataset) {
    if (dataset == null) return null;
    final start = dataset['coverageStart'];
    final end = dataset['coverageEnd'];
    if (start == null && end == null) return null;

    String fmt(dynamic value) {
      if (value == null) return '';
      if (value is DateTime) {
        return DateFormat('MMM yyyy').format(value);
      }
      final parsed = DateTime.tryParse(value.toString());
      if (parsed != null) return DateFormat('MMM yyyy').format(parsed);
      return value.toString();
    }

    final startLabel = fmt(start);
    final endLabel = fmt(end);
    if (startLabel.isNotEmpty && endLabel.isNotEmpty) {
      return '$startLabel – $endLabel';
    }
    return startLabel.isNotEmpty ? startLabel : endLabel;
  }

  Future<List<AlertItem>> fetchAlerts({
    int? limit,
    bool includeLiveGpsAlert = true,
  }) async {
    final dataset = await ApiService.fetchLatestValidatedDataset();
    final datasetId = dataset?['id']?.toString();
    if (datasetId == null) return [];

    final dataCoverage = _formatDatasetCoverage(dataset);
    final generatedAt = DateTime.now();

    final heatmapData = await ApiService.fetchDistrictHeatmap(
      datasetId: datasetId,
      selectedYear: 'All',
      selectedMonth: 'All',
      selectedDisease: 'All',
      selectedCaseClassification: 'All',
    );

    final points = (heatmapData?['points'] as List<dynamic>? ?? [])
        .cast<Map<String, dynamic>>();

    final withCases = points
        .where((p) => ((p['cases'] as num?) ?? 0) > 0)
        .toList()
      ..sort((a, b) {
        final bAvg = (b['districtAvgIncident'] as num?) ?? 0;
        final aAvg = (a['districtAvgIncident'] as num?) ?? 0;
        if (bAvg != aAvg) return bAvg.compareTo(aAvg);
        return ((b['cases'] as num?) ?? 0).compareTo((a['cases'] as num?) ?? 0);
      });

    final built = withCases
        .map(
          (point) => _alertFromHeatmapPoint(
            point,
            generatedAt: generatedAt,
            dataCoverage: dataCoverage,
          ),
        )
        .toList();

    if (includeLiveGpsAlert) {
      final live = RiskAlertService.instance.latestMessage.value;
      if (live != null) {
        built.insert(
          0,
          AlertItem(
            id: 'live_gps',
            title: 'You are in a high-risk area',
            risk: RiskLevel.high,
            riskBand: 'High',
            message: live,
            location: 'Current GPS location',
            district: 'Current location',
            cases: 'Active alert',
            distance: 'Immediate',
            generatedAt: generatedAt,
          ),
        );
      }
    }

    if (limit != null && limit > 0 && built.length > limit) {
      return built.take(limit).toList();
    }
    return built;
  }

  AlertItem _alertFromHeatmapPoint(
    Map<String, dynamic> point, {
    required DateTime generatedAt,
    String? dataCoverage,
  }) {
    final district = FormatHelpers.normalizeDistrict(point['district']?.toString());
    final barangayNo = (point['barangayNo'] as num?)?.toInt() ?? 0;
    final barangayName = point['barangay']?.toString();
    final location = FormatHelpers.formatLocationDisplay(
      district: district,
      barangayNo: barangayNo,
      barangayName: barangayName,
    );

    final cases = (point['cases'] as num?) ?? 0;
    final avgIncident = (point['districtAvgIncident'] as num?)?.toDouble() ?? 0;
    final riskBand = point['risk']?.toString() ??
        HeatmapCaseBuilders.getRiskBand(avgIncident);
    final level = levelFromHeatmapBand(riskBand);
    final districtTotal = point['districtTotalCases'] ?? 0;

    return AlertItem(
      id: 'heatmap_$barangayNo',
      title: '$riskBand Risk Area Alert',
      risk: level,
      riskBand: riskBand,
      message:
          'Foodborne illness activity detected in this barangay based on the '
          'latest validated dataset.',
      location: location,
      district: district,
      barangayNo: barangayNo > 0 ? barangayNo : null,
      barangayName: barangayName,
      cases: '$cases case${cases == 1 ? '' : 's'} here',
      distance: '$districtTotal district total',
      avgIncidentRate: avgIncident,
      generatedAt: generatedAt,
      dataCoverage: dataCoverage,
      areaData: point,
    );
  }
}
