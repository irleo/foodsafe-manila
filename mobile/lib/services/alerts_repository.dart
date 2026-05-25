import '../services/api_service.dart';
import '../services/manila_geo_service.dart';
import '../services/risk_alert_service.dart';
import '../widgets/alerts_widgets.dart';

/// Shared alert data used by Home and Alerts screens.
class AlertsRepository {
  AlertsRepository._();
  static final AlertsRepository instance = AlertsRepository._();

  static const String defaultHeatmapMonths = '6';

  static RiskLevel levelFromString(String? level) {
    switch (level) {
      case 'high':
        return RiskLevel.high;
      case 'moderate':
        return RiskLevel.moderate;
      default:
        return RiskLevel.low;
    }
  }

  static String riskLabel(RiskLevel level) {
    switch (level) {
      case RiskLevel.high:
        return 'High Risk';
      case RiskLevel.moderate:
        return 'Moderate Risk';
      case RiskLevel.low:
        return 'Low Risk';
    }
  }

  /// Builds alert items from the risk heatmap API (same source as Alerts page).
  Future<List<AlertItem>> fetchAlerts({
    String months = defaultHeatmapMonths,
    int? limit,
    bool includeLiveGpsAlert = true,
  }) async {
    final heatmap = await ApiService.getRiskHeatmap(months: months);
    final areas =
        (heatmap?['areas'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();

    final highAreas = areas
        .where((a) => a['riskLevel'] == 'high')
        .toList()
      ..sort(
        (a, b) => ((b['riskScore'] as num?) ?? 0)
            .compareTo((a['riskScore'] as num?) ?? 0),
      );

    final built = highAreas.map((area) => _alertFromArea(area)).toList();

    if (includeLiveGpsAlert) {
      final live = RiskAlertService.instance.latestMessage.value;
      if (live != null) {
        built.insert(
          0,
          AlertItem(
            title: 'You are in a high-risk area',
            risk: RiskLevel.high,
            message: live,
            location: 'Current GPS location',
            timeAgo: 'Now',
            cases: 'Active alert',
            distance: 'Immediate',
            areaData: null,
          ),
        );
      }
    }

    if (limit != null && limit > 0 && built.length > limit) {
      return built.take(limit).toList();
    }
    return built;
  }

  AlertItem _alertFromArea(Map<String, dynamic> area) {
    final district = area['district']?.toString() ?? '';
    final barangay = area['barangay']?.toString() ?? '';
    final barangayNo = (area['barangayNo'] as num?)?.toInt() ?? 0;
    final location = ManilaGeoService.formatLocation(
      district: district,
      locality: barangay,
      barangayNo: barangayNo,
    );
    final level = levelFromString(area['riskLevel']?.toString());
    final official = area['officialCases'] ?? 0;
    final suspected = area['suspectedCases'] ?? 0;
    final total = area['totalCases'] ?? 0;
    final score = area['riskScore'] ?? 0;

    return AlertItem(
      title: area['riskLabel']?.toString() ?? 'Area Risk Alert',
      risk: level,
      message:
          'Elevated foodborne illness risk detected in this area. '
          'Official cases: $official, suspected reports: $suspected.',
      location: location,
      timeAgo: 'Live',
      cases: '$total total cases',
      distance: 'Risk score $score',
      areaData: area,
    );
  }
}
