import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';
import '../services/manila_geo_service.dart';
import '../services/risk_alert_service.dart';
import '../widgets/alerts_widgets.dart';

class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key});

  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  int unreadCount = 0;
  RiskLevel? selectedFilter;
  bool showFilterChips = false;
  bool isLoading = true;
  List<AlertItem> alerts = [];

  @override
  void initState() {
    super.initState();
    _loadAlerts();
    RiskAlertService.instance.latestMessage.addListener(_onRiskMessage);
  }

  @override
  void dispose() {
    RiskAlertService.instance.latestMessage.removeListener(_onRiskMessage);
    super.dispose();
  }

  void _onRiskMessage() {
    _loadAlerts();
  }

  RiskLevel _levelFromString(String? level) {
    switch (level) {
      case 'high':
        return RiskLevel.high;
      case 'moderate':
        return RiskLevel.moderate;
      default:
        return RiskLevel.low;
    }
  }

  Future<void> _loadAlerts() async {
    setState(() => isLoading = true);
    final heatmap = await ApiService.getRiskHeatmap(months: '6');
    final areas = (heatmap?['areas'] as List<dynamic>? ?? [])
        .cast<Map<String, dynamic>>();

    final highAreas = areas
        .where((a) => a['riskLevel'] == 'high')
        .toList()
      ..sort(
        (a, b) => ((b['riskScore'] as num?) ?? 0)
            .compareTo((a['riskScore'] as num?) ?? 0),
      );

    final built = highAreas.take(12).map((area) {
      final district = area['district']?.toString() ?? '';
      final barangay = area['barangay']?.toString() ?? '';
      final barangayNo = (area['barangayNo'] as num?)?.toInt() ?? 0;
      final location = ManilaGeoService.formatLocation(
        district: district,
        locality: barangay,
        barangayNo: barangayNo,
      );

      return AlertItem(
        title: 'Area Risk Alert',
        risk: _levelFromString(area['riskLevel']?.toString()),
        message:
            'Elevated foodborne illness risk detected. Official: ${area['officialCases'] ?? 0}, Suspected: ${area['suspectedCases'] ?? 0}.',
        location: location,
        timeAgo: 'Live',
        cases: '${area['totalCases'] ?? 0} total cases',
        distance: 'Score ${area['riskScore'] ?? 0}',
      );
    }).toList();

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
        ),
      );
    }

    if (!mounted) return;
    setState(() {
      alerts = built;
      unreadCount = built.length;
      isLoading = false;
    });
  }

  List<AlertItem> get filteredAlerts {
    if (selectedFilter == null) return alerts;
    return alerts.where((a) => a.risk == selectedFilter).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        title: Text(
          'Alerts',
          style: GoogleFonts.inter(
            fontSize: 20,
            fontWeight: FontWeight.w600,
          ),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(36), 
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Row(
              children: [
                _filterChip('All', null),
                const SizedBox(width: 8),
                _filterChip('High', RiskLevel.high),
                const SizedBox(width: 8),
                _filterChip('Moderate', RiskLevel.moderate),
                const SizedBox(width: 8),
                _filterChip('Low', RiskLevel.low),
              ],
            ),
          ),
        ),
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : SafeArea(
            child: Stack(
              children: [
                Column(
                  children: [
                    Expanded(
                      child: filteredAlerts.isEmpty
                          ? Center(
                              child: Text(
                                'No alerts available',
                                style: GoogleFonts.inter(color: Colors.grey),
                              ),
                            )
                          : ListView.builder(
                              padding: const EdgeInsets.all(16),
                              itemCount: filteredAlerts.length,
                              itemBuilder: (context, index) {
                                return AlertCard(item: filteredAlerts[index]);
                              },
                            ),
                    ),
                  ],
                ),
                if(unreadCount > 0)
                Positioned(
                  left: 16,
                  right: 16,
                  bottom: 36,
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 430),
                      child: SizedBox(
                        height: 48,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF2563EB),
                            foregroundColor: Colors.white,
                            shape: const StadiumBorder(),
                            elevation: 6,
                          ),
                          onPressed: () => setState(() => unreadCount = 0),
                          child: Text(
                            unreadCount == 0
                                ? "All Read"
                                : "Mark All as Read ($unreadCount)",
                            style: GoogleFonts.inter(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          )
    );
  }

  Widget _filterChip(String label, RiskLevel? level) {
    final selected = selectedFilter == level;
    return FilterChip(
      label: Text(
        label,
        style: GoogleFonts.inter(
          color: selected ? Colors.white : Colors.black87,
          fontWeight: FontWeight.w500,
        ),
      ),
      selected: selected,
      selectedColor: const Color(0xFF2563EB),
      backgroundColor: const Color(0xFFF3F4F6),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      side: BorderSide.none,
      onSelected: (_) => setState(() => selectedFilter = level),
    );
  }
}
