import 'dart:math';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../data/mock_analytics_data.dart';

enum TimeRange { day, week, month }

enum ViewTab { trends, districts, illnesses }

class TimeRangeChips extends StatelessWidget {
  final TimeRange value;
  final ValueChanged<TimeRange> onChanged;

  const TimeRangeChips({
    super.key,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        chip('Day', TimeRange.day),
        const SizedBox(width: 8),
        chip('Week', TimeRange.week),
        const SizedBox(width: 8),
        chip('Month', TimeRange.month),
      ],
    );
  }

  Widget chip(String label, TimeRange v) {
    final selected = value == v;
    return ChoiceChip(
      label: Text(
        label,
        style: GoogleFonts.inter(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: selected ? Colors.white : const Color(0xFF374151),
        ),
      ),
      selected: selected,
      onSelected: (_) => onChanged(v),
      selectedColor: const Color(0xFF2563EB),
      backgroundColor: const Color(0xFFF3F4F6),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      side: BorderSide.none,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
    );
  }
}

class CurrentCasesCard extends StatelessWidget {
  final int cases;
  final double changePercent;
  final String subtitle;
  final VoidCallback onTap;

  const CurrentCasesCard({
    super.key,
    required this.cases,
    required this.changePercent,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF2563EB), Color(0xFF1D4ED8)],
          ),
          borderRadius: BorderRadius.circular(20),
          boxShadow: const [
            BoxShadow(
              blurRadius: 14,
              offset: Offset(0, 6),
              color: Color(0x1A000000),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Current Cases',
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          color: const Color(0xFFBFDBFE),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '$cases',
                        style: GoogleFonts.inter(
                          fontSize: 34,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0x33EF4444),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.trending_up,
                        size: 16,
                        color: Colors.white,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '${changePercent.toStringAsFixed(1)}%',
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              subtitle,
              style: GoogleFonts.inter(
                fontSize: 13,
                color: const Color(0xFFBFDBFE),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class SegmentedTabs extends StatelessWidget {
  final ViewTab value;
  final ValueChanged<ViewTab> onChanged;

  const SegmentedTabs({
    super.key,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Row(
        children: [
          tab('Trends', ViewTab.trends),
          tab('Districts', ViewTab.districts),
          tab('Illnesses', ViewTab.illnesses),
        ],
      ),
    );
  }

  Widget tab(String label, ViewTab tab) {
    final selected = value == tab;
    return Expanded(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => onChanged(tab),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: selected ? const Color(0xFF2563EB) : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: selected ? Colors.white : const Color(0xFF4B5563),
            ),
          ),
        ),
      ),
    );
  }
}

class ChartCard extends StatelessWidget {
  final String title;
  final Widget child;
  const ChartCard({super.key, required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFF3F4F6)),
        boxShadow: const [
          BoxShadow(
            blurRadius: 10,
            offset: Offset(0, 4),
            color: Color(0x0F000000),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 10),
          SizedBox(height: 250, child: child),
        ],
      ),
    );
  }
}

class Chart extends StatelessWidget {
final ViewTab tab;
final AnalyticsBundle bundle;

const Chart({super.key, required this.tab, required this.bundle});

@override
Widget build(BuildContext context) {
  switch (tab) {
    case ViewTab.trends:
      return lineChart(bundle.trends);
    case ViewTab.districts:
      return barChart(bundle.districts);
    case ViewTab.illnesses:
      return pieChart(bundle.illnesses);
    }
  }
}

double getInterval(double maxValue, int steps) {
  final rawInterval = maxValue / steps;
  return (rawInterval / steps).ceil() * 5;
}

double getMaxY(double maxValue, int steps) {
  final interval = getInterval(maxValue, steps);
  return interval * steps;
}

Widget lineChart(List<TrendPoint> data) {
  final maxValue = data.map((e) => e.value).reduce(max);
  final interval = getInterval(maxValue, 5);
  final maxY = getMaxY(maxValue, 5);

  return Container(
    padding: EdgeInsets.all(10),
    child: LineChart(
      LineChartData(
        minX: 0,
        maxX: (data.length - 1).toDouble(),
        minY: 0,
        maxY: maxY,

        gridData: FlGridData(
          show: true,
          drawVerticalLine: true,
          getDrawingHorizontalLine: (value) => FlLine(
            color: Colors.grey.withValues(alpha: 0.15),
            strokeWidth: 1,
          ),
          getDrawingVerticalLine: (value) => FlLine(
            color: Colors.grey.withValues(alpha: 0.15),
            strokeWidth: 1,
          ),
        ),

        borderData: FlBorderData(
          show: true,
          border: Border(
            left: BorderSide(color: Colors.grey.shade400),
            bottom: BorderSide(color: Colors.grey.shade400),
            right: BorderSide.none,
            top: BorderSide.none,
          ),
        ),

        titlesData: FlTitlesData(
          rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
          topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),

          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              interval: 1,
              getTitlesWidget: (value, meta) {
                if (value.toInt() >= data.length) return const SizedBox();
                return Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    data[value.toInt()].label,
                    style: GoogleFonts.inter(fontSize: 11),
                  ),
                );
              },
            ),
          ),

          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 40,
              interval: interval,
              getTitlesWidget: (value, meta) {
                return Padding(
                  padding: const EdgeInsetsGeometry.only(right: 8),
                  child: Text(
                    value.toInt().toString(),
                    style: GoogleFonts.inter(fontSize: 11),
                    textAlign: TextAlign.right,
                  ),
                );
              },
            ),
          ),
        ),

        // Line data
        lineBarsData: [
          LineChartBarData(
            isCurved: true,
            curveSmoothness: 0.3,
            color: const Color(0xFF3B6DFF),
            barWidth: 2.5,

            dotData: FlDotData(
              show: true,
              getDotPainter: (spot, percent, barData, index) {
                return FlDotCirclePainter(
                  radius: 4,
                  color: const Color(0xFF3B6DFF),
                  strokeWidth: 0,
                );
              },
            ),

            belowBarData: BarAreaData(show: false),

            spots: List.generate(
              data.length,
              (i) => FlSpot(i.toDouble(), data[i].value),
            ),
          ),
        ],
      ),
    ),
  );
}

Widget barChart(List<DistrictData> data) {
  final maxValue = data.map((e) => e.value).reduce(max);
  final interval = getInterval(maxValue, 5);
  final maxY = getMaxY(maxValue, 5);
  
  return Padding(
    padding: const EdgeInsets.all(12),
    child: BarChart(
      BarChartData(
        maxY: maxY,
        alignment: BarChartAlignment.spaceAround,

        gridData: FlGridData(
          show: true,
          drawVerticalLine: false,
          getDrawingHorizontalLine: (value) => FlLine(
            color: Colors.grey.withValues(alpha: 0.15),
            strokeWidth: 1,
          ),
        ),

        borderData: FlBorderData(
          show: true,
          border: Border(
            left: BorderSide(color: Colors.grey.shade400),
            bottom: BorderSide(color: Colors.grey.shade400),
            right: BorderSide.none,
            top: BorderSide.none,
          ),
        ),

        titlesData: FlTitlesData(
          topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),

          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 35,
              interval: interval,
              getTitlesWidget: (value, meta) {
                return Padding(
                  padding: const EdgeInsetsGeometry.only(right: 8),
                  child: Text(
                    value.toInt().toString(),
                    style: GoogleFonts.inter(fontSize: 11),
                    textAlign: TextAlign.right,
                  ),
                );
              },
            ),
          ),

          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              getTitlesWidget: (value, meta) {
                if (value.toInt() >= data.length) return const SizedBox();
                return Text(
                  data[value.toInt()].name,
                  style: GoogleFonts.inter(fontSize: 11),
                );
              },
            ),
          ),
        ),

        barGroups: List.generate(
          data.length,
          (i) => BarChartGroupData(
            x: i,
            barRods: [
              BarChartRodData(
                toY: data[i].value,
                width: 18,
                borderRadius: BorderRadius.circular(6),
                gradient: const LinearGradient(
                  colors: [Color(0xFF3B82F6), Color(0xFF2563EB)],
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
} 

Widget pieChart(List<IllnessData> data) {
  final total = data.fold<double>(0, (sum, item) => sum + item.value);

  return Column(
    children: [
      Expanded(
        child: PieChart(
          PieChartData(
            sectionsSpace: 1,
            centerSpaceRadius: 0,
            startDegreeOffset: -135,

            sections: data.map((e) {
              final percentage = (e.value / total) * 100;
              return PieChartSectionData(
                value: e.value,
                color: e.color,
                radius: 90,
                title: '${percentage.toStringAsFixed(0)}%',
                titleStyle: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
                titlePositionPercentageOffset: 0.7,
              );
            }).toList(),
          ),
        ),
      ),

      const SizedBox(height: 12),

      Wrap(
        spacing: 14,
        runSpacing: 8,
        children: data.map((e) {
          return Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  color: e.color,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
              const SizedBox(width: 6),
              Text(
                e.name,
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          );
        }).toList(),
      ),
    ],
  );
}

class SectionTitle extends StatelessWidget {
  final String text;
  const SectionTitle({super.key, this.text = ''});

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w700),
    );
  }
}

class InsightCard extends StatelessWidget {
  final Color colorBg;
  final Color colorBorder;
  final Color iconBg;
  final IconData icon;
  final String title;
  final String description;

  const InsightCard({
    super.key,
    required this.colorBg,
    required this.colorBorder,
    required this.iconBg,
    required this.icon,
    required this.title,
    required this.description,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colorBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colorBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: Colors.white, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  description,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: const Color(0xFF4B5563),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class StatCard extends StatelessWidget {
  final String label;
  final String value;
  final String footnote;
  final Color footnoteColor;

  const StatCard({
    super.key,
    required this.label,
    required this.value,
    required this.footnote,
    required this.footnoteColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF3F4F6)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 12,
              color: const Color(0xFF4B5563),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: GoogleFonts.inter(fontSize: 24, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          Text(
            footnote,
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: footnoteColor,
            ),
          ),
        ],
      ),
    );
  }
}
