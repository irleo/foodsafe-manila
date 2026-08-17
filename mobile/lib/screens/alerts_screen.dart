import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../services/alerts_read_store.dart';
import '../services/alerts_repository.dart';
import '../widgets/alerts_widgets.dart';
import '../widgets/app_loading.dart';

class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key});

  @override
  State<AlertsScreen> createState() => AlertsScreenState();
}

class AlertsScreenState extends State<AlertsScreen> {
  Set<String> readIds = {};
  bool isLoading = true;
  String? errorMessage;
  List<AlertItem> alerts = [];

  int get unreadCount =>
      alerts.where((a) => !readIds.contains(a.id)).length;

  @override
  void initState() {
    super.initState();
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

  List<AlertItem> get filteredAlerts => alerts;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        title: Text(
          'Health Advisories',
          style: GoogleFonts.inter(
            fontSize: 20,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: isLoading
          ? const AppLoadingCenter(message: 'Loading advisories…')
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
            'No published health advisories',
            style: GoogleFonts.inter(
              fontSize: 18,
              color: Colors.grey.shade500,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Only advisories published by authorized health personnel will appear here.',
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

}
