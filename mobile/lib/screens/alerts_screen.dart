import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../services/alerts_read_store.dart';
import '../services/alerts_repository.dart';
import '../services/risk_alert_service.dart';
import '../widgets/alerts_widgets.dart';
import '../widgets/app_loading.dart';

class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key});

  @override
  State<AlertsScreen> createState() => AlertsScreenState();
}

class AlertsScreenState extends State<AlertsScreen> {
  Set<String> readIds = {};
  RiskLevel? selectedFilter;
  bool isLoading = true;
  String? errorMessage;
  List<AlertItem> alerts = [];

  int get unreadCount =>
      alerts.where((a) => !readIds.contains(a.id)).length;

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

  Future<void> refreshData() => _loadAlerts();

  Future<void> _loadAlerts() async {
    setState(() {
      isLoading = true;
      errorMessage = null;
    });

    try {
      final built = await AlertsRepository.instance.fetchAlerts();
      final stored = await AlertsReadStore.loadReadIds();
      if (!mounted) return;
      setState(() {
        alerts = built;
        readIds = stored;
        isLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        alerts = [];
        readIds = {};
        isLoading = false;
        errorMessage = 'Failed to load alerts. Pull to refresh.';
      });
    }
  }

  Future<void> _markAllRead() async {
    final ids = alerts.map((a) => a.id).toList();
    await AlertsReadStore.markAllRead(ids);
    if (!mounted) return;
    setState(() {
      readIds = {...readIds, ...ids};
    });
  }

  Future<void> _markRead(AlertItem item) async {
    if (readIds.contains(item.id)) return;
    await AlertsReadStore.markRead(item.id);
    if (!mounted) return;
    setState(() => readIds = {...readIds, item.id});
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
          preferredSize: const Size.fromHeight(44),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Row(
              children: [
                _filterChip('All', null),
                const SizedBox(width: 8),
                _filterChip('Critical', RiskLevel.critical),
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
          ? const AppLoadingCenter(message: 'Loading alerts…')
          : errorMessage != null
              ? _buildErrorState()
              : SafeArea(
                  child: Stack(
                    children: [
                      Column(
                        children: [
                          Expanded(
                            child: filteredAlerts.isEmpty
                                ? _buildEmptyState()
                                : RefreshIndicator(
                                    onRefresh: _loadAlerts,
                                    color: AppLoadingIndicator.primaryColor,
                                    child: ListView.builder(
                                      physics:
                                          const AlwaysScrollableScrollPhysics(),
                                      padding: const EdgeInsets.fromLTRB(
                                        16,
                                        16,
                                        16,
                                        80,
                                      ),
                                      itemCount: filteredAlerts.length,
                                      itemBuilder: (context, index) {
                                        final item = filteredAlerts[index];
                                        final isUnread =
                                            !readIds.contains(item.id);
                                        return Padding(
                                          padding:
                                              const EdgeInsets.only(bottom: 16),
                                          child: AlertCard(
                                            item: item,
                                            isUnread: isUnread,
                                            onTap: () async {
                                              await _markRead(item);
                                              if (!context.mounted) return;
                                              showAlertDetailSheet(
                                                context,
                                                item,
                                              );
                                            },
                                          ),
                                        );
                                      },
                                    ),
                                  ),
                          ),
                        ],
                      ),
                      if (unreadCount > 0)
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
                                  onPressed: _markAllRead,
                                  child: Text(
                                    'Mark All as Read ($unreadCount)',
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
                ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            LucideIcons.bellOff,
            size: 64,
            color: Colors.grey.shade300,
          ),
          const SizedBox(height: 16),
          Text(
            'No alerts available',
            style: GoogleFonts.inter(
              fontSize: 18,
              color: Colors.grey.shade500,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Risk alerts from the heatmap will appear here when cases are reported',
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
              fontSize: 14,
              color: Colors.grey.shade400,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(LucideIcons.circleAlert, size: 48, color: Colors.grey.shade400),
            const SizedBox(height: 12),
            Text(
              errorMessage!,
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(color: Colors.grey.shade600),
            ),
            const SizedBox(height: 16),
            TextButton(
              onPressed: _loadAlerts,
              child: Text(
                'Retry',
                style: GoogleFonts.inter(
                  fontWeight: FontWeight.w600,
                  color: AppLoadingIndicator.primaryColor,
                ),
              ),
            ),
          ],
        ),
      ),
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
      checkmarkColor: Colors.white,
      selectedColor: const Color(0xFF2563EB),
      backgroundColor: const Color(0xFFF3F4F6),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      side: BorderSide.none,
      onSelected: (_) => setState(() => selectedFilter = level),
    );
  }
}