import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../widgets/analytics_widgets.dart';
import '../data/mock_analytics_data.dart';

class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  TimeRange range = TimeRange.day;
  ViewTab tab = ViewTab.trends;

  @override
  Widget build(BuildContext context) {
    final data = MockAnalyticsData.getData(range);

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        shape: Border(
          bottom: BorderSide(
            color: Colors.grey.shade300, // light gray border
            width: 1,
          ),
        ),
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
              'Analytics & Trends',
              style: GoogleFonts.inter(
                fontSize: 20,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Disease patterns and insights',
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
            child: TimeRangeChips(
              value: range,
              onChanged: (v) => setState(() => range = v),
            ),
          ),
        ),
      ),
      body: SafeArea(
        top: true,
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                CurrentCasesCard(
                  cases: data.currentCases,
                  changePercent: data.percentChange,
                  subtitle: range == TimeRange.day
                      ? 'Increase from previous day'
                      : range == TimeRange.week
                          ? 'Increase from previous week'
                          : 'Increase from previous month',
                  onTap: () {},
                ),
                const SizedBox(height: 14),
                SegmentedTabs(
                  value: tab,
                  onChanged: (v) => setState(() => tab = v),
                ),
                const SizedBox(height: 14),
                ChartCard(
                  title: tab == ViewTab.trends
                      ? 'Case Trends'
                      : tab == ViewTab.districts
                          ? 'Cases by District'
                          : 'Illness Distribution',
                  child: Chart(tab: tab, bundle: data,),
                ),
                const SizedBox(height: 14),
                SectionTitle(text: 'Key Insights'),
                const SizedBox(height: 10),
                InsightCard(
                  colorBg: const Color(0xFFEFF6FF),
                  colorBorder: const Color(0xFFDBEAFE),
                  iconBg: const Color(0xFF2563EB),
                  icon: Icons.trending_up,
                  title: 'Highest Cases',
                  description: (() {
                    final highestDistrict = data.districts.reduce((a, b) => a.value > b.value ? a : b);
                    final period = range == TimeRange.day
                        ? 'this day'
                        : range == TimeRange.week
                            ? 'this week'
                            : 'this month';
                    return '${highestDistrict.name} district has the highest case $period (${highestDistrict.value.toInt()})';
                  })(),
                ),
                const SizedBox(height: 10),
                InsightCard(
                  colorBg: const Color(0xFFF5F3FF),
                  colorBorder: const Color(0xFFE9D5FF),
                  iconBg: const Color(0xFF7C3AED),
                  icon: Icons.calendar_month,
                  title: 'Most Common',
                  description: (() {
                    final mostCommonIllness = data.illnesses.reduce((a, b) => a.value > b.value ? a : b);
                    final totalCases = data.illnesses.fold<double>(0, (sum, item) => sum + item.value);
                    final percentage = ((mostCommonIllness.value / totalCases) * 100).toStringAsFixed(0);
                    final period = range == TimeRange.day
                        ? 'this day'
                        : range == TimeRange.week
                            ? 'this week'
                            : 'this month';
                    return '${mostCommonIllness.name} accounts for $percentage% of all cases $period';
                  })(),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: StatCard(
                        label: 'Total Cases',
                        value: data.trends.fold<double>(0, (sum, t) => sum + t.value).toInt().toString(),
                        footnote: range == TimeRange.day
                            ? 'This Day'
                            : range == TimeRange.week
                                ? 'This Week'
                                : 'This Month',
                        footnoteColor: const Color(0xFF16A34A),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: StatCard(
                        label: 'Avg Per Period',
                        value: (data.trends.fold<double>(0, (sum, t) => sum + t.value) / data.trends.length)
                            .toStringAsFixed(1),
                        footnote: 'cases/${range.name}',
                        footnoteColor: const Color(0xFF6B7280),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}