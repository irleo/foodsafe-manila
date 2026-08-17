import '../widgets/alerts_widgets.dart';

/// Citizen-facing alerts must come from an authorized published advisory.
/// Case concentration and analytical thresholds do not automatically create
/// public risk alerts.
class AlertsRepository {
  AlertsRepository._();
  static final AlertsRepository instance = AlertsRepository._();

  Future<List<AlertItem>> fetchAlerts({
    int? limit,
    bool includeLiveGpsAlert = true,
  }) async {
    return const <AlertItem>[];
  }
}
