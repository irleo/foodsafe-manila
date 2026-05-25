import 'package:flutter/material.dart';

import '../services/alerts_repository.dart';

import '../services/heatmap_risk_service.dart';

import '../services/risk_alert_service.dart';

import '../widgets/alerts_widgets.dart';

import '../widgets/home_widgets.dart';



class HomeScreen extends StatefulWidget {

  final VoidCallback onProfileTap;

  final VoidCallback? onNavigateToAlerts;

  final VoidCallback? onNavigateToMap;



  const HomeScreen({

    super.key,

    required this.onProfileTap,

    this.onNavigateToAlerts,

    this.onNavigateToMap,

  });



  @override

  State<HomeScreen> createState() => HomeScreenState();

}



class HomeScreenState extends State<HomeScreen> {

  HeatmapRiskSnapshot? heatmapSnapshot;

  List<AlertItem> nearbyAlerts = [];

  bool isHeatmapLoading = true;

  bool isAlertsLoading = true;

  @override

  void initState() {

    super.initState();

    _loadAll();

    RiskAlertService.instance.latestMessage.addListener(_onLiveRiskUpdate);

  }



  @override

  void dispose() {

    RiskAlertService.instance.latestMessage.removeListener(_onLiveRiskUpdate);

    super.dispose();

  }



  void _onLiveRiskUpdate() {

    _loadNearbyAlerts();

  }



  Future<void> refreshData() => _loadAll();



  Future<void> _loadAll() async {

    await Future.wait([

      _loadHeatmapRisk(),

      _loadNearbyAlerts(),

    ]);

  }



  Future<void> _loadHeatmapRisk() async {

    setState(() => isHeatmapLoading = true);

    final snapshot = await HeatmapRiskService.instance.load();

    if (!mounted) return;

    setState(() {

      heatmapSnapshot = snapshot;

      isHeatmapLoading = false;

    });

  }



  Future<void> _loadNearbyAlerts() async {

    setState(() => isAlertsLoading = true);

    try {

      final items = await AlertsRepository.instance.fetchAlerts(limit: 3);

      if (!mounted) return;

      setState(() {

        nearbyAlerts = items;

        isAlertsLoading = false;

      });

    } catch (_) {

      if (!mounted) return;

      setState(() {

        nearbyAlerts = [];

        isAlertsLoading = false;

      });

    }

  }



  @override

  Widget build(BuildContext context) {

    return Scaffold(

      backgroundColor: const Color(0xFFF9FAFB),

      body: SafeArea(

        top: true,

        child: RefreshIndicator(

          onRefresh: _loadAll,

          color: const Color(0xFF2563EB),

          child: SingleChildScrollView(

            physics: const AlwaysScrollableScrollPhysics(),

            padding: const EdgeInsets.only(bottom: 24),

            child: Column(

              children: [

                Header(onTap: widget.onProfileTap),

                Padding(

                  padding: const EdgeInsets.symmetric(horizontal: 16),

                  child: Transform.translate(

                    offset: const Offset(0, -20),

                    child: Column(

                      children: [

                        DashboardSummaryCard(

                          data: heatmapSnapshot?.dashboardSummary,

                          referencePeriod: heatmapSnapshot?.referencePeriod,

                          isLoading: isHeatmapLoading,

                          error: heatmapSnapshot?.error,

                        ),

                        const SizedBox(height: 14),

                        CurrentRiskCard(

                          riskStats: heatmapSnapshot?.riskStats ?? {},

                          isLoading: isHeatmapLoading,

                          error: heatmapSnapshot?.error,

                        ),

                        const SizedBox(height: 14),

                        MapCtaCard(

                          riskStats: heatmapSnapshot?.riskStats ?? {},

                          isLoading: isHeatmapLoading,

                          onTap: widget.onNavigateToMap,

                        ),

                        const SizedBox(height: 14),

                        TopDiseaseSection(

                          diseases: heatmapSnapshot?.topDiseases ?? [],

                          referencePeriod: heatmapSnapshot?.referencePeriod,

                          isLoading: isHeatmapLoading,

                          error: heatmapSnapshot?.error,

                        ),

                        const SizedBox(height: 14),

                        TopDistrictsSection(

                          districts: heatmapSnapshot?.topDistricts ?? [],

                          referencePeriod: heatmapSnapshot?.referencePeriod,

                          isLoading: isHeatmapLoading,

                          error: heatmapSnapshot?.error,

                        ),

                        const SizedBox(height: 14),

                        NearbyAlertsSection(

                          alerts: nearbyAlerts,

                          isLoading: isAlertsLoading,

                          onSeeAll: widget.onNavigateToAlerts,

                        ),

                      ],

                    ),

                  ),

                ),

              ],

            ),

          ),

        ),

      ),

    );

  }

}


