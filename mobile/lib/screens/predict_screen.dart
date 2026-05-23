import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../data/mock_analytics_data.dart';
import '../widgets/analytics_widgets.dart' as analytics_widgets;
import '../widgets/predict_widgets.dart';

class PredictScreen extends StatefulWidget {
  const PredictScreen({super.key});

  @override
  State<PredictScreen> createState() => _PredictScreenState();
}

class _PredictScreenState extends State<PredictScreen> {
  bool showForecast = true;

  final List<DistrictRisk> districts = const [
    DistrictRisk(
      name: 'Tondo',
      level: RiskLevel.high,
      score: 82,
      estCases: 67,
    ),
    DistrictRisk(
      name: 'Binondo',
      level: RiskLevel.moderate,
      score: 58,
      estCases: 42,
    ),
    DistrictRisk(
      name: 'Sta. Cruz',
      level: RiskLevel.high,
      score: 75,
      estCases: 54,
    ),
    DistrictRisk(
      name: 'Sampaloc',
      level: RiskLevel.moderate,
      score: 45,
      estCases: 34,
    ),
    DistrictRisk(
      name: 'San Miguel',
      level: RiskLevel.low,
      score: 28,
      estCases: 18,
    ),
    DistrictRisk(
      name: 'Malate',
      level: RiskLevel.low,
      score: 22,
      estCases: 1
    ),
  ];

  final data = MockAnalyticsData.getData(analytics_widgets.TimeRange.week);

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
            const SizedBox(height: 8),
            Text(
              'Predictions & History',
              style: GoogleFonts.inter(
                fontSize: 20,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Predictive analytics risk forecasting',
              style: GoogleFonts.inter(
                fontSize: 13,
                color: const Color(0xFF4B5563),
              ),
            ),
          ],
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(54),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: SegmentedToggle(
              leftLabel: 'Forecast',
              rightLabel: 'History',
              isLeftSelected: showForecast,
              onChanged: (v) => setState(() => showForecast = v),
            ),
          ),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
            child: showForecast 
                ? forecastView() 
                : historyView(),
          ),
        ),
      ),
    );
  }

  Widget forecastView() {
    final highCount = districts.where((d) => d.level == RiskLevel.high).length;
    final avgRisk = districts.isEmpty
        ? 0
        : districts.map((d) => d.score).reduce((a, b) => a + b) /
            districts.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: GradientStatCard(
                title: 'High Risk Districts',
                value: '$highCount',
                icon: Icons.warning_amber_rounded,
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFFEF4444), Color(0xFFDC2626)],
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: GradientStatCard(
                title: 'Average Risk Score',
                value: avgRisk.toStringAsFixed(1),
                icon: Icons.shield_outlined,
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFF3B82F6), Color(0xFF2563EB)],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        ChartCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Case Forecast',
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Container(
                height: 200,
                width: double.infinity,
                alignment: Alignment.center,
                child: Chart(showForecast: showForecast, bundle: data)
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  LegendDot(color: Colors.green, label: 'Actual Cases'),
                  const SizedBox(width: 16),
                  LegendDot(color: Colors.blue, label: 'Forecasted Cases'),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        Text(
          'District Risk Predictions',
          style: GoogleFonts.inter(
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 14),
        ...districts.map(
          (d) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: DistrictRiskCard(district: d, onTap: () {}),
          ),
        ),
      ],
    );
  }

  Widget historyView() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ChartCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Prediction Accuracy',
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Container(
                height: 200,
                width: double.infinity,
                alignment: Alignment.center,
                child: Chart(showForecast: showForecast, bundle: data)
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  LegendDot(color: Colors.green, label: 'Actual Cases'),
                  const SizedBox(width: 16),
                  LegendDot(color: Colors.blue, label: 'Predicted Cases'),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              child: MetricCard(
                icon: Icons.trending_up,
                color: Colors.green,
                label: 'Accuracy',
                value: '87.5%',
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: MetricCard(
                icon: Icons.calendar_month,
                color: Colors.blue,
                label: 'Avg Error',
                value: '±2 cases',
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        ModelPerformanceCard(
          predictionsMade: 143,
          accuratePredictions: 125,
          lastUpdated: '2 hours ago',
        ),
      ],
    );
  }
}
