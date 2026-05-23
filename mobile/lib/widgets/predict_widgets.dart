import 'dart:math';

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../data/mock_analytics_data.dart';

class SegmentedToggle extends StatelessWidget {
  final String leftLabel;
  final String rightLabel;
  final bool isLeftSelected;
  final ValueChanged<bool> onChanged;

  const SegmentedToggle({
    super.key,
    required this.leftLabel,
    required this.rightLabel,
    required this.isLeftSelected,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: const Color(0xFFF3F4F6),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Expanded(
            child: SegButton(
              label: leftLabel,
              selected: isLeftSelected,
              onTap: () => onChanged(true),
            ),
          ),
          Expanded(
            child: SegButton(
              label: rightLabel,
              selected: !isLeftSelected,
              onTap: () => onChanged(false),
            ),
          ),
        ],
      ),
    );
  }
}

class SegButton extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const SegButton({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: selected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.black87 : Colors.grey.shade700,
          ),
        ),
      ),
    );
  }
}

class GradientStatCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Gradient gradient;

  const GradientStatCard({
    super.key,
    required this.title,
    required this.value,
    required this.icon,
    required this.gradient,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: gradient,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: Colors.white, size: 22),
              const Spacer(),
              Text(
                value,
                style: GoogleFonts.inter(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            title,
            style: GoogleFonts.inter(
              fontSize: 11,
              color: Colors.white.withValues(alpha: 0.85),
            ),
          ),
        ],
      ),
    );
  }
}

class ChartCard extends StatelessWidget {
  final Widget child;
  const ChartCard({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFF1F1F1)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: child,
    );
  }
}

class Chart extends StatelessWidget {
  final bool showForecast;
  final AnalyticsBundle bundle;

const Chart({super.key, required this.showForecast, required this.bundle});

@override
Widget build(BuildContext context) {
  switch (showForecast) {
    case true:
      return lineChart(bundle.trends, bundle.forecastTrends);
    case false:
      return lineChart(bundle.trends, bundle.predictedTrendsHistory);
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

Widget lineChart(List<TrendPoint> data1, List<TrendPoint> data2) {
    final allValues = [
    ...data1.map((e) => e.value),
    ...data2.map((e) => e.value),
  ];
  final maxValue = allValues.reduce(max);
  final interval = getInterval(maxValue, 5);
  final maxY = getMaxY(maxValue, 5);

  return Container(
    padding: EdgeInsets.all(10),
    child: LineChart(
      LineChartData(
        minX: 0,
        maxX: (data1.length - 1).toDouble(),
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
                if (value.toInt() >= data1.length) return const SizedBox();
                return Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    data1[value.toInt()].label,
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
            color: Colors.green,
            barWidth: 2.5,

            dotData: FlDotData(
              show: true,
              getDotPainter: (spot, percent, barData, index) {
                return FlDotCirclePainter(
                  radius: 4,
                  color: Colors.green,
                  strokeWidth: 0,
                );
              },
            ),

            belowBarData: BarAreaData(show: false),

            spots: List.generate(
              data1.length,
              (i) => FlSpot(i.toDouble(), data1[i].value),
            ),
          ),

          LineChartBarData(
            isCurved: true,
            curveSmoothness: 0.3,
            color: Colors.blue,
            barWidth: 2.5,
            dashArray: [4, 4],

            dotData: FlDotData(
              show: false,
            ),

            belowBarData: BarAreaData(show: false),

            spots: List.generate(
              data2.length,
              (i) => FlSpot(i.toDouble(), data2[i].value),
            ),
          ),
        ],
      ),
    ),
  );
}

class DistrictRiskCard extends StatelessWidget {
  final DistrictRisk district;
  final VoidCallback onTap;

  const DistrictRiskCard({
    super.key,
    required this.district,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = district.level.colors;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: colors.border),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: colors.softBg,
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.trending_up, color: colors.icon, size: 24),
            ),
            const SizedBox(width: 12),

            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          district.name,
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: colors.pillBg,
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: colors.border),
                        ),
                        child: Text(
                          district.level.label,
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: colors.pillText,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  Wrap(
                    spacing: 14,
                    runSpacing: 6,
                    children: [
                      Text(
                        'Score: ${district.score}',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          color: Colors.grey.shade600,
                        ),
                      ),
                      Text(
                        'Est. ${district.estCases} cases',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 10),

                  ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: LinearProgressIndicator(
                      value: (district.score / 100).clamp(0, 1),
                      minHeight: 8,
                      backgroundColor: Colors.grey.shade200,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        colors.progress,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class LegendDot extends StatelessWidget {
  final Color color;
  final String label;

  const LegendDot({super.key, required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(label, style: GoogleFonts.inter(fontSize: 11, color: Colors.grey)),
      ],
    );
  }
}

class MetricCard extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String label;
  final String value;

  const MetricCard({
    super.key,
    required this.icon,
    required this.color,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color, size: 18),
          ),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label,
                  style: GoogleFonts.inter(fontSize: 11, color: Colors.grey)),
              Text(value,
                  style: GoogleFonts.inter(
                      fontSize: 16, fontWeight: FontWeight.w600)),
            ],
          ),
        ],
      ),
    );
  }
}

class ModelPerformanceCard extends StatelessWidget {
  const ModelPerformanceCard({
    super.key,
    required this.predictionsMade,
    required this.accuratePredictions,
    required this.lastUpdated,
  });

  final int predictionsMade;
  final int accuratePredictions;
  final String lastUpdated;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFDBEAFE)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Model Performance',
            style: GoogleFonts.inter(
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 12),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Predictions Made',
                style: GoogleFonts.inter(
                  fontSize: 11,
                  color: Colors.grey,
                ),
              ),
              Text(
                predictionsMade.toString(),
                style: GoogleFonts.inter(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),

          const SizedBox(height: 8),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Accurate Predictions',
                style: GoogleFonts.inter(
                  fontSize: 11,
                  color: Colors.grey,
                ),
              ),
              Text(
                accuratePredictions.toString(),
                style: GoogleFonts.inter(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF16A34A),
                ),
              ),
            ],
          ),

          const SizedBox(height: 8),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Last Updated',
                style: GoogleFonts.inter(
                  fontSize: 11,
                  color: Colors.grey,
                ),
              ),
              Text(
                lastUpdated,
                style: GoogleFonts.inter(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

enum RiskLevel { high, moderate, low }

extension on RiskLevel {
  String get label {
    switch (this) {
      case RiskLevel.high:
        return 'High';
      case RiskLevel.moderate:
        return 'Moderate';
      case RiskLevel.low:
        return 'Low';
    }
  }

  RiskColors get colors {
    switch (this) {
      case RiskLevel.high:
        return const RiskColors(
          border: Color(0xFFFECACA),
          softBg: Color(0xFFFEE2E2),
          icon: Color(0xFFDC2626),
          pillBg: Color(0xFFFEE2E2),
          pillText: Color(0xFFB91C1C),
          progress: Color(0xFFEF4444),
        );
      case RiskLevel.moderate:
        return const RiskColors(
          border: Color(0xFFFDE68A),
          softBg: Color(0xFFFEF3C7),
          icon: Color(0xFFD97706),
          pillBg: Color(0xFFFEF3C7),
          pillText: Color(0xFFB45309),
          progress: Color(0xFFF59E0B),
        );
      case RiskLevel.low:
        return const RiskColors(
          border: Color(0xFFBBF7D0),
          softBg: Color(0xFFDCFCE7),
          icon: Color(0xFF16A34A),
          pillBg: Color(0xFFDCFCE7),
          pillText: Color(0xFF15803D),
          progress: Color(0xFF22C55E),
        );
    }
  }
}

class RiskColors {
  final Color border;
  final Color softBg;
  final Color icon;
  final Color pillBg;
  final Color pillText;
  final Color progress;

  const RiskColors({
    required this.border,
    required this.softBg,
    required this.icon,
    required this.pillBg,
    required this.pillText,
    required this.progress,
  });
}

class DistrictRisk {
  final String name;
  final RiskLevel level;
  final int score;
  final int estCases;

  const DistrictRisk({
    required this.name,
    required this.level,
    required this.score,
    required this.estCases,
  });
}
