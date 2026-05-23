import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../services/api_service.dart';
import '../services/manila_geo_service.dart';
import '../widgets/constrained_dropdown.dart';

class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => AnalyticsScreenState();
}

class AnalyticsScreenState extends State<AnalyticsScreen> {
  bool showStatistics = true;
  bool showOfficial = true;

  /// Prediction chart filters
  String predictionDistrict = 'all';
  String predictionRange = '3';

  /// Case Trends filters
  String trendsYear = DateTime.now().year.toString();
  String trendsClassification = 'all';

  /// District chart filters
  String districtMonth = DateTime.now().month.toString();
  String districtYear = DateTime.now().year.toString();
  String districtClassification = 'all';

  /// Disease chart filters
  String diseaseMonth = DateTime.now().month.toString();
  String diseaseYear = DateTime.now().year.toString();
  String diseaseClassification = 'all';

  final List<String> districtItems = [
    'all',
    'District 1',
    'District 2',
    'District 3',
    'District 4',
    'District 5',
    'District 6',
  ];

  final List<String> rangeItems = ['3', '6', '12'];

  final List<String> monthItems = [
    'all',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    '11',
    '12',
  ];
  final List<String> yearItems = ['all', '2023', '2024', '2025', '2026'];
  final List<String> caseClassificationItems = [
    'all',
    'confirmed',
    'suspected',
    'probable',
  ];

  Map<String, dynamic>? overviewData;
  Map<String, dynamic>? predictionData;
  Map<String, dynamic>? trendsData;
  Map<String, dynamic>? districtData;
  Map<String, dynamic>? diseaseData;

  bool isOverviewLoading = true;
  bool isPredictionLoading = true;
  bool isTrendsLoading = true;
  bool isDistrictLoading = true;
  bool isDiseaseLoading = true;

  double getNiceInterval(double max) {
    if (max <= 10) return 2;
    if (max <= 25) return 5;
    if (max <= 50) return 10;
    if (max <= 75) return 15;
    if (max <= 100) return 20;
    if (max <= 250) return 50;
    if (max <= 500) return 100;
    if (max <= 750) return 150;
    if (max <= 1000) return 200;
    return (max / 5).ceilToDouble();
  }

  double getNiceMaxY(double maxValue) {
    final interval = getNiceInterval(maxValue);
    return (maxValue / interval).ceil() * interval;
  }

  @override
  void initState() {
    super.initState();
    loadAllAnalytics();
  }

  Future<void> refreshData() => loadAllAnalytics();

  Future<void> loadAllAnalytics() async {
    await Future.wait([
      fetchOverview(),
      fetchPredictions(),
      fetchTrends(),
      fetchDistrict(),
      fetchDisease(),
    ]);
  }

  Future<void> fetchOverview() async {
    setState(() => isOverviewLoading = true);

    final result = await ApiService.getOfficialAnalytics();

    setState(() {
      overviewData = result;
      isOverviewLoading = false;
    });
  }

  List<dynamic> _predictionSeries(
    Map<String, dynamic> district,
    List<String> keys,
  ) {
    for (final key in keys) {
      final value = district[key];
      if (value is List) return value;
    }
    return const [];
  }

  num? _seriesValue(Map<String, dynamic> item, {bool predicted = false}) {
    final raw = predicted
        ? (item['predictedCases'] ??
              item['predicted'] ??
              item['yhat'] ??
              item['forecast'])
        : (item['cases'] ??
              item['actualCases'] ??
              item['actual'] ??
              item['value'] ??
              item['total']);
    if (raw is num) return raw;
    if (raw != null) return num.tryParse(raw.toString());
    return null;
  }

  void _mergeMonth(
    Map<String, Map<String, dynamic>> merged,
    int year,
    int month, {
    num? actual,
    num? predicted,
  }) {
    final key = '$year-$month';
    merged.putIfAbsent(
      key,
      () => {
        'year': year,
        'month': month,
        'hasActual': false,
        'actual': 0,
        'predicted': null,
      },
    );
    final entry = merged[key]!;
    if (actual != null) {
      entry['hasActual'] = true;
      entry['actual'] = (entry['actual'] as num) + actual;
    }
    if (predicted != null) {
      entry['predicted'] = (entry['predicted'] as num? ?? 0) + predicted;
    }
  }

  int _monthsBetween(DateTime from, DateTime to) {
    return (to.year - from.year) * 12 + (to.month - from.month);
  }

  List<Map<String, dynamic>> _buildPredictionPoints(
    List<dynamic> selectedDistricts,
    int rangeMonths,
  ) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    final merged = <String, Map<String, dynamic>>{};

    for (final rawDistrict in selectedDistricts) {
      if (rawDistrict is! Map) continue;
      final d = Map<String, dynamic>.from(rawDistrict);

      final history = _predictionSeries(d, [
        'historicalSeries',
        'historySeries',
        'actualSeries',
        'history',
      ]);
      final backtest = _predictionSeries(d, [
        'backtestSeries',
        'validationSeries',
        'inSampleSeries',
      ]);
      final forecastList = _predictionSeries(d, [
        'forecastSeries',
        'forecast',
        'predictedSeries',
        'predictionSeries',
        'forecasts',
      ]);

      for (final rawItem in history) {
        if (rawItem is! Map) continue;
        final item = Map<String, dynamic>.from(rawItem);
        final year = (item['year'] as num?)?.toInt();
        final month = (item['month'] as num?)?.toInt();
        if (year == null || month == null) continue;
        _mergeMonth(merged, year, month, actual: _seriesValue(item));
      }

      for (final rawItem in backtest) {
        if (rawItem is! Map) continue;
        final item = Map<String, dynamic>.from(rawItem);
        final year = (item['year'] as num?)?.toInt();
        final month = (item['month'] as num?)?.toInt();
        if (year == null || month == null) continue;
        _mergeMonth(
          merged,
          year,
          month,
          predicted: _seriesValue(item, predicted: true),
        );
      }

      for (final rawItem in forecastList) {
        if (rawItem is! Map) continue;
        final item = Map<String, dynamic>.from(rawItem);
        final year = (item['year'] as num?)?.toInt();
        final month = (item['month'] as num?)?.toInt();
        if (year == null || month == null) continue;
        _mergeMonth(
          merged,
          year,
          month,
          predicted: _seriesValue(item, predicted: true),
        );
      }

      if (forecastList.isEmpty) {
        final nextForecast = d['nextForecast'];
        if (nextForecast is Map) {
          final item = Map<String, dynamic>.from(nextForecast);
          final year = (item['year'] as num?)?.toInt();
          final month = (item['month'] as num?)?.toInt();
          if (year != null && month != null) {
            _mergeMonth(
              merged,
              year,
              month,
              predicted: _seriesValue(item, predicted: true),
            );
          }
        }
      }
    }

    final sorted = merged.values.toList()
      ..sort((a, b) {
        final da = DateTime(a['year'] as int, a['month'] as int);
        final db = DateTime(b['year'] as int, b['month'] as int);
        return da.compareTo(db);
      });

    if (sorted.isEmpty) return [];

    final lastPredicted = sorted.lastWhere(
      (e) => e['predicted'] != null,
      orElse: () => sorted.last,
    );
    final lastDate = DateTime(
      lastPredicted['year'] as int,
      lastPredicted['month'] as int,
    );

    return sorted
        .where((e) {
          final pointDate = DateTime(e['year'] as int, e['month'] as int);
          final offset = _monthsBetween(pointDate, lastDate);
          return offset >= 0 && offset <= rangeMonths;
        })
        .map((e) {
          final hasActual = e['hasActual'] == true;
          final predicted = e['predicted'];
          return {
            'label': '${months[e['month'] - 1]} ${e['year']}',
            'actual': hasActual ? e['actual'] : null,
            'predicted': predicted,
            'isLatestForecast':
                e['year'] == lastPredicted['year'] &&
                e['month'] == lastPredicted['month'] &&
                predicted != null,
          };
        })
        .toList();
  }

  Future<void> fetchPredictions() async {
    setState(() => isPredictionLoading = true);

    final district = ManilaGeoService.districtFromUiValue(predictionDistrict);

    try {
      final result = await ApiService.fetchLatestPredictions(
        district: predictionDistrict == 'all' ? null : district,
      );

      if (result['hasPrediction'] != true) {
        setState(() {
          predictionData = {'points': []};
          isPredictionLoading = false;
        });
        return;
      }

      final payload = result['payload'];
      final districts = payload?['districts'] as List<dynamic>? ?? [];

      if (districts.isEmpty) {
        setState(() {
          predictionData = {'points': []};
          isPredictionLoading = false;
        });
        return;
      }

      final selectedDistricts = predictionDistrict == 'all'
          ? districts
          : districts
                .where((d) => d is Map && d['district'] == district)
                .toList();

      final rangeMonths = int.parse(predictionRange);
      final points = _buildPredictionPoints(selectedDistricts, rangeMonths);

      setState(() {
        predictionData = {'points': points};
        isPredictionLoading = false;
      });
    } catch (_) {
      setState(() {
        predictionData = {'points': []};
        isPredictionLoading = false;
      });
    }
  }

  Future<void> fetchTrends() async {
    setState(() => isTrendsLoading = true);

    final result = await ApiService.getOfficialAnalytics(
      year: trendsYear,
      caseClassification: trendsClassification,
      includeReports:
          trendsClassification == 'all' || trendsClassification == 'suspected',
    );

    setState(() {
      trendsData = result;
      isTrendsLoading = false;
    });
  }

  Future<void> fetchDistrict() async {
    setState(() => isDistrictLoading = true);

    final result = await ApiService.getOfficialAnalytics(
      month: districtMonth,
      year: districtYear,
      caseClassification: districtClassification,
      includeReports:
          districtClassification == 'all' ||
          districtClassification == 'suspected',
    );

    setState(() {
      districtData = result;
      isDistrictLoading = false;
    });
  }

  Future<void> fetchDisease() async {
    setState(() => isDiseaseLoading = true);

    final result = await ApiService.getOfficialAnalytics(
      month: diseaseMonth,
      year: diseaseYear,
      caseClassification: diseaseClassification,
      includeReports:
          diseaseClassification == 'all' ||
          diseaseClassification == 'suspected',
    );

    setState(() {
      diseaseData = result;
      isDiseaseLoading = false;
    });
  }

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
            Text(
              'Analytics',
              style: GoogleFonts.inter(
                fontSize: 20,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
            child: analyticsView(),
          ),
        ),
      ),
    );
  }

  Widget analyticsView() {
    final growth = overviewData?['growth'];

    final growthValue = double.tryParse(growth.toString()) ?? 0.0;

    final growthText =
        "${growthValue >= 0 ? '+' : ''}${growthValue.toStringAsFixed(1)}%";

    Color growthColor = growthValue >= 0
        ? const Color(0xFF059669) // green
        : const Color(0xFFDC2626); // red

    return Column(
      children: [
        /// KPI CARDS
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              SizedBox(
                width: 160,
                height: 160,
                child: _kpiCard(
                  colorBar: const Color(0xFF34D399),
                  icon: LucideIcons.activity,
                  iconBg: const Color(0xFFD1FAE5),
                  iconColor: const Color(0xFF10B981),
                  title: "Total Cases",
                  value: overviewData?['totalCases']?.toString() ?? '0',
                  subtitleWidget: Container(
                    margin: const EdgeInsets.only(top: 8),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: Color.lerp(growthColor, Colors.white, 0.85),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.trending_down, size: 14, color: growthColor),
                        SizedBox(width: 4),
                        Text(
                          growthText,
                          style: GoogleFonts.inter(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: growthColor,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              SizedBox(width: 12),
              SizedBox(
                width: 160,
                height: 160,
                child: _kpiCard(
                  colorBar: const Color(0xFFF97316),
                  icon: LucideIcons.mapPin,
                  iconBg: const Color(0xFFFFF7ED),
                  iconColor: const Color(0xFFF97316),
                  title: "Top District",
                  value: overviewData?['topDistrict'] ?? 'N/A',
                  valueFontSize: 16,
                  subtitleText: "Highest case volume of all",
                ),
              ),
              SizedBox(width: 12),
              SizedBox(
                width: 160,
                height: 160,
                child: _kpiCard(
                  colorBar: const Color(0xFFA78BFA),
                  icon: LucideIcons.stethoscope,
                  iconBg: const Color(0xFFF5F3FF),
                  iconColor: const Color(0xFFA78BFA),
                  title: "Top Disease",
                  value: overviewData?['topDisease'] ?? 'N/A',
                  valueFontSize: 16,
                  subtitleText: "Most frequent diagnosis",
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 16),

        predictionChart(),

        const SizedBox(height: 16),

        caseTrendsChart(),

        const SizedBox(height: 16),

        casesByDistrictChart(),

        const SizedBox(height: 16),

        diseaseDistributionChart(),
      ],
    );
  }

  Widget chartLoading() {
    return SizedBox(
      height: 180,
      child: Center(
        child: SizedBox(
          width: 22,
          height: 22,
          child: CircularProgressIndicator(
            strokeWidth: 2.4,
            color: Colors.blue,
          ),
        ),
      ),
    );
  }

  Widget predictionChart() {
    const minY = 0.0;

    final points = predictionData?['points'] as List<dynamic>? ?? [];
    final labels = points.map((p) => (p['label'] ?? '').toString()).toList();

    List<FlSpot> actualSpots = [];
    List<FlSpot> predictedSpots = [];

    for (var i = 0; i < points.length; i++) {
      final point = points[i];
      final actual = point['actual'];
      final predicted = point['predicted'];

      if (actual != null) {
        actualSpots.add(FlSpot(i.toDouble(), (actual as num).toDouble()));
      }
      if (predicted != null) {
        predictedSpots.add(FlSpot(i.toDouble(), (predicted as num).toDouble()));
      }
    }

    final allValues = [
      ...actualSpots.map((s) => s.y),
      ...predictedSpots.map((s) => s.y),
    ];
    final maxValue = allValues.isEmpty
        ? 10.0
        : allValues.reduce((a, b) => a > b ? a : b);
    final maxY = getNiceMaxY(maxValue);
    final interval = getNiceInterval(maxY);

    LineChartBarData line(
      List<FlSpot> data, {
      required Color color,
      bool dashed = false,
    }) {
      return LineChartBarData(
        spots: data,
        isCurved: true,
        curveSmoothness: 0.35,
        color: color,
        barWidth: 2.5,
        isStrokeCapRound: true,
        dotData: FlDotData(
          show: true,
          getDotPainter: (spot, percent, barData, index) {
            return FlDotCirclePainter(
              radius: 2, // 👈 smaller = thinner points
              color: Colors.white,
              strokeWidth: 2,
              strokeColor: color,
            );
          },
        ),
        dashArray: dashed ? [4, 6] : null,
      );
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          /// Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: Color.lerp(Color(0xFF3b82f6), Colors.white, 0.85),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      LucideIcons.trendingUpDown,
                      size: 12,
                      color: Color(0xFF3b82f6),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Predictions',
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF111827),
                    ),
                  ),
                ],
              ),
            ],
          ),

          SizedBox(height: 12),

          Row(
            children: [
              Expanded(
                child: _buildDropdown(
                  label: 'District',
                  value: predictionDistrict,
                  items: districtItems,
                  onChanged: (value) {
                    setState(() => predictionDistrict = value!);
                    fetchPredictions();
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildDropdown(
                  label: 'Time Range',
                  value: predictionRange,
                  items: rangeItems,
                  onChanged: (value) {
                    setState(() => predictionRange = value!);
                    fetchPredictions();
                  },
                ),
              ),
            ],
          ),

          const SizedBox(height: 24),

          /// Chart
          isPredictionLoading
              ? chartLoading()
              : Container(
                  height: 180,
                  padding: const EdgeInsets.only(right: 26),
                  child: LineChart(
                    LineChartData(
                      minY: minY,
                      maxY: allValues.isEmpty || allValues.every((e) => e == 0)
                          ? 10
                          : maxY,

                      gridData: FlGridData(
                        show: true,
                        drawVerticalLine: false,
                        getDrawingHorizontalLine: (value) => FlLine(
                          color: Colors.grey.withValues(alpha: 0.15),
                          strokeWidth: 1,
                          dashArray: [4, 4],
                        ),
                      ),

                      borderData: FlBorderData(
                        show: true,
                        border: Border(
                          left: BorderSide(color: Colors.grey.shade400),
                          bottom: BorderSide(color: Colors.grey.shade400),
                        ),
                      ),

                      titlesData: FlTitlesData(
                        rightTitles: AxisTitles(
                          sideTitles: SideTitles(showTitles: false),
                        ),
                        topTitles: AxisTitles(
                          sideTitles: SideTitles(showTitles: false),
                        ),
                        bottomTitles: AxisTitles(
                          sideTitles: SideTitles(
                            showTitles: true,
                            interval: labels.length > 12 ? 2 : 1,
                            reservedSize: 32,
                            getTitlesWidget: (value, _) {
                              final index = value.toInt();

                              if (index >= 0 && index < labels.length) {
                                final parts = labels[index].split(' ');

                                return Padding(
                                  padding: const EdgeInsets.only(top: 6),
                                  child: Column(
                                    children: [
                                      Text(
                                        parts[0],
                                        style: GoogleFonts.inter(fontSize: 9),
                                      ),
                                      Text(
                                        parts[1],
                                        style: GoogleFonts.inter(
                                          fontSize: 8,
                                          color: Colors.grey,
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              }

                              return const SizedBox();
                            },
                          ),
                        ),
                        leftTitles: AxisTitles(
                          sideTitles: SideTitles(
                            showTitles: true,
                            reservedSize: 26,
                            interval: interval,
                            getTitlesWidget: (value, _) {
                              return Padding(
                                padding: const EdgeInsets.only(right: 6),
                                child: Text(
                                  value.toInt().toString(),
                                  textAlign: TextAlign.end,
                                  style: GoogleFonts.inter(
                                    fontSize: 10,
                                    color: Colors.grey,
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                      ),

                      lineBarsData: [
                        if (actualSpots.isNotEmpty)
                          line(actualSpots, color: const Color(0xFF10B981)),
                        if (predictedSpots.isNotEmpty)
                          line(
                            predictedSpots,
                            color: Color(0xFF3b82f6),
                            dashed: true,
                          ),
                      ],
                    ),
                  ),
                ),
          SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              Row(
                children: [
                  Container(
                    width: 9,
                    height: 9,
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981),
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                  const SizedBox(width: 6),
                  SizedBox(width: 6),
                  Text(
                    'Actual',
                    style: GoogleFonts.inter(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: Colors.black,
                    ),
                  ),
                ],
              ),
              Row(
                children: [
                  Container(
                    width: 9,
                    height: 9,
                    decoration: BoxDecoration(
                      color: Color(0xFF3b82f6),
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                  const SizedBox(width: 6),
                  SizedBox(width: 6),
                  Text(
                    'Prediction',
                    style: GoogleFonts.inter(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: Colors.black,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget caseTrendsChart() {
    double minY = 0;

    final trend = trendsData?['trendData'] as List<dynamic>? ?? [];

    final bool isAllYears = trendsYear == 'all';
    final currentYear = DateTime.now().year;
    final currentMonth = DateTime.now().month;

    List<double> values = [];
    List<String> labels = [];

    if (isAllYears) {
      for (final item in trend) {
        values.add((item['total'] as num).toDouble());
        labels.add(item['_id'].toString()); // year label
      }
    } else {
      int maxMonth = 12;

      if (int.parse(trendsYear) == currentYear) {
        maxMonth = currentMonth; // only available months
      }

      values = List<double>.filled(maxMonth, 0);

      for (final item in trend) {
        final month = item['_id'] as int;
        final total = (item['total'] as num).toDouble();

        if (month <= maxMonth) {
          values[month - 1] = total;
        }
      }

      labels = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ].sublist(0, maxMonth);
    }

    List<FlSpot> getTrendSpots() {
      return List.generate(
        values.length,
        (index) => FlSpot(index.toDouble(), values[index]),
      );
    }

    double getTrendMaxY() {
      if (trend.isEmpty) return 100;

      final max = values.isEmpty ? 100 : values.reduce((a, b) => a > b ? a : b);

      return getNiceMaxY(max.toDouble());
    }

    final maxY = getTrendMaxY();
    final interval = getNiceInterval(maxY);

    LineChartBarData line(List<FlSpot> data) {
      return LineChartBarData(
        spots: data,
        isCurved: true,
        curveSmoothness: 0.35,
        color: const Color(0xFF10B981),
        barWidth: 2.5,
        isStrokeCapRound: true,
        dotData: FlDotData(
          show: true,
          getDotPainter: (spot, percent, barData, index) {
            return FlDotCirclePainter(
              radius: 2, // 👈 smaller = thinner points
              color: Colors.white,
              strokeWidth: 2,
              strokeColor: const Color(0xFF10B981),
            );
          },
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          /// Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFD1FAE5),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      LucideIcons.activity,
                      size: 12,
                      color: const Color(0xFF10B981),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Case Trends',
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF111827),
                    ),
                  ),
                ],
              ),
            ],
          ),

          SizedBox(height: 12),

          Row(
            children: [
              Expanded(
                child: _buildDropdown(
                  label: 'Year',
                  value: trendsYear,
                  items: yearItems,
                  onChanged: (value) {
                    setState(() => trendsYear = value!);
                    fetchTrends();
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildDropdown(
                  label: 'Classification',
                  value: trendsClassification,
                  items: caseClassificationItems,
                  onChanged: (value) {
                    setState(() => trendsClassification = value!);
                    fetchTrends();
                  },
                ),
              ),
            ],
          ),

          const SizedBox(height: 24),

          /// Chart
          isTrendsLoading
              ? chartLoading()
              : Container(
                  height: 180,
                  padding: const EdgeInsets.only(right: 26),
                  child: LineChart(
                    LineChartData(
                      minY: minY,
                      maxY: values.every((e) => e == 0) ? 10 : maxY,

                      gridData: FlGridData(
                        show: true,
                        drawVerticalLine: false,
                        getDrawingHorizontalLine: (value) => FlLine(
                          color: Colors.grey.withValues(alpha: 0.15),
                          strokeWidth: 1,
                          dashArray: [4, 4],
                        ),
                      ),

                      borderData: FlBorderData(
                        show: true,
                        border: Border(
                          left: BorderSide(color: Colors.grey.shade400),
                          bottom: BorderSide(color: Colors.grey.shade400),
                        ),
                      ),

                      titlesData: FlTitlesData(
                        rightTitles: AxisTitles(
                          sideTitles: SideTitles(showTitles: false),
                        ),
                        topTitles: AxisTitles(
                          sideTitles: SideTitles(showTitles: false),
                        ),
                        bottomTitles: AxisTitles(
                          sideTitles: SideTitles(
                            showTitles: true,
                            interval: 1,
                            reservedSize: 32,
                            getTitlesWidget: (value, _) {
                              final index = value.toInt();

                              if (index >= 0 && index < labels.length) {
                                return Padding(
                                  padding: const EdgeInsets.only(top: 6),
                                  child: Text(
                                    labels[index],
                                    style: GoogleFonts.inter(
                                      fontSize: 10,
                                      color: Colors.grey,
                                    ),
                                  ),
                                );
                              }

                              return const SizedBox();
                            },
                          ),
                        ),
                        leftTitles: AxisTitles(
                          sideTitles: SideTitles(
                            showTitles: true,
                            reservedSize: 26,
                            interval: interval,
                            getTitlesWidget: (value, _) {
                              return Padding(
                                padding: const EdgeInsets.only(right: 6),
                                child: Text(
                                  value.toInt().toString(),
                                  textAlign: TextAlign.end,
                                  style: GoogleFonts.inter(
                                    fontSize: 10,
                                    color: Colors.grey,
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                      ),

                      lineBarsData: [line(getTrendSpots())],
                    ),
                  ),
                ),
        ],
      ),
    );
  }

  Widget casesByDistrictChart() {
    final district = districtData?['districtData'] as List<dynamic>? ?? [];

    final districts = [
      'District 1',
      'District 2',
      'District 3',
      'District 4',
      'District 5',
      'District 6',
    ];

    final Map<String, double> districtMap = {
      for (var item in district)
        item['_id'].toString(): (item['total'] as num).toDouble(),
    };

    final values = districts
        .map((districtName) => districtMap[districtName] ?? 0.0)
        .toList();

    final maxValue = values.isEmpty
        ? 100
        : values.reduce((a, b) => a > b ? a : b);

    final maxY = getNiceMaxY(maxValue.toDouble());

    final interval = getNiceInterval(maxValue.toDouble());

    final List<Color> barColors = [
      Color(0xFF3B82F6), // blue
      Color(0xFF10B981), // green
      Color(0xFFF59E0B), // amber
      Color(0xFFEF4444), // red
      Color(0xFF8B5CF6), // purple
      Color(0xFF06B6D4), // cyan
    ];

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          /// Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF7ED),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      LucideIcons.mapPin,
                      size: 12,
                      color: const Color(0xFFF97316),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Cases by District',
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF111827),
                    ),
                  ),
                ],
              ),
            ],
          ),

          SizedBox(height: 12),

          Row(
            children: [
              Expanded(
                child: _buildDropdown(
                  label: 'Month',
                  value: districtMonth,
                  items: monthItems,
                  onChanged: (value) {
                    setState(() => districtMonth = value!);
                    fetchDistrict();
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildDropdown(
                  label: 'Year',
                  value: districtYear,
                  items: yearItems,
                  onChanged: (value) {
                    setState(() => districtYear = value!);
                    fetchDistrict();
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildDropdown(
                  label: 'Classification',
                  value: districtClassification,
                  items: caseClassificationItems,
                  onChanged: (value) {
                    setState(() => districtClassification = value!);
                    fetchDistrict();
                  },
                ),
              ),
            ],
          ),

          const SizedBox(height: 24),

          /// Chart
          isDistrictLoading
              ? chartLoading()
              : Container(
                  height: 180,
                  padding: const EdgeInsets.only(right: 26),
                  child: BarChart(
                    BarChartData(
                      maxY: maxY,
                      gridData: FlGridData(
                        show: true,
                        drawVerticalLine: false,
                        horizontalInterval: interval,
                        getDrawingHorizontalLine: (value) => FlLine(
                          color: Colors.grey.withValues(alpha: 0.15),
                          strokeWidth: 1,
                          dashArray: [4, 4],
                        ),
                      ),
                      borderData: FlBorderData(
                        show: true,
                        border: Border(
                          left: BorderSide(color: Colors.grey.shade400),
                          bottom: BorderSide(color: Colors.grey.shade400),
                        ),
                      ),
                      titlesData: FlTitlesData(
                        topTitles: AxisTitles(
                          sideTitles: SideTitles(showTitles: false),
                        ),
                        rightTitles: AxisTitles(
                          sideTitles: SideTitles(showTitles: false),
                        ),

                        /// Y AXIS
                        leftTitles: AxisTitles(
                          sideTitles: SideTitles(
                            showTitles: true,
                            reservedSize: 26,
                            interval: interval,
                            getTitlesWidget: (value, _) {
                              return Padding(
                                padding: EdgeInsetsGeometry.only(right: 6),
                                child: Text(
                                  value.toInt().toString(),
                                  textAlign: TextAlign.end,
                                  style: GoogleFonts.inter(
                                    fontSize: 10,
                                    color: Colors.grey,
                                  ),
                                ),
                              );
                            },
                          ),
                        ),

                        /// X AXIS
                        bottomTitles: AxisTitles(
                          sideTitles: SideTitles(
                            showTitles: true,
                            reservedSize: 44,
                            getTitlesWidget: (value, meta) {
                              int index = value.toInt();
                              if (index >= districts.length) {
                                return const SizedBox();
                              }

                              return Transform.rotate(
                                angle: -0.6,
                                child: Padding(
                                  padding: EdgeInsets.only(top: 12),
                                  child: Text(
                                    districts[index],
                                    style: GoogleFonts.inter(
                                      fontSize: 10,
                                      color: Colors.grey,
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                      ),

                      barGroups: List.generate(districts.length, (index) {
                        return BarChartGroupData(
                          x: index,
                          barRods: [
                            BarChartRodData(
                              toY: values[index],
                              width: 40,
                              borderRadius: const BorderRadius.vertical(
                                top: Radius.circular(8),
                              ),
                              color: barColors[index % barColors.length],
                            ),
                          ],
                        );
                      }),
                    ),
                  ),
                ),
        ],
      ),
    );
  }

  Widget diseaseDistributionChart() {
    final rawDiseases =
        diseaseData?['diseaseDistribution'] as List<dynamic>? ?? [];

    final totalCases = rawDiseases.fold<double>(
      0,
      (sum, item) => sum + (item['total'] as num).toDouble(),
    );

    final colors = [
      Colors.red,
      Colors.orange,
      Colors.amber,
      Colors.purple,
      Colors.blue,
      Colors.cyan,
      Colors.green,
    ];

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          /// Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF5F3FF),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      LucideIcons.stethoscope,
                      size: 12,
                      color: const Color(0xFFA78BFA),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Disease Distribution',
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF111827),
                    ),
                  ),
                ],
              ),
            ],
          ),

          SizedBox(height: 12),

          Row(
            children: [
              Expanded(
                child: _buildDropdown(
                  label: 'Month',
                  value: diseaseMonth,
                  items: monthItems,
                  onChanged: (value) {
                    setState(() => diseaseMonth = value!);
                    fetchDisease();
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildDropdown(
                  label: 'Year',
                  value: diseaseYear,
                  items: yearItems,
                  onChanged: (value) {
                    setState(() => diseaseYear = value!);
                    fetchDisease();
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildDropdown(
                  label: 'Classification',
                  value: diseaseClassification,
                  items: caseClassificationItems,
                  onChanged: (value) {
                    setState(() => diseaseClassification = value!);
                    fetchDisease();
                  },
                ),
              ),
            ],
          ),

          SizedBox(height: 24),

          /// Chart
          isDiseaseLoading
              ? chartLoading()
              : SizedBox(
                  height: 180,
                  child: PieChart(
                    PieChartData(
                      sectionsSpace: 2,
                      centerSpaceRadius: 0,
                      sections: rawDiseases.isEmpty
                          ? [
                              PieChartSectionData(
                                value: 1,
                                color: Colors.grey.shade200,
                                title: '',
                                radius: 80,
                              ),
                            ]
                          : List.generate(rawDiseases.length, (index) {
                              final item = rawDiseases[index];
                              final value = (item['total'] as num).toDouble();

                              final percent = totalCases == 0
                                  ? 0
                                  : ((value / totalCases) * 100).round();

                              return PieChartSectionData(
                                value: value,
                                color: colors[index % colors.length],
                                title: '$percent%',
                                radius: 80,
                                titleStyle: GoogleFonts.inter(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              );
                            }),
                    ),
                  ),
                ),

          if (!isDiseaseLoading && rawDiseases.isNotEmpty) ...[
            SizedBox(height: 24),
            Wrap(
              spacing: 14,
              runSpacing: 8,
              children: List.generate(rawDiseases.length, (index) {
                final item = rawDiseases[index];

                return Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 9,
                      height: 9,
                      decoration: BoxDecoration(
                        color: colors[index % colors.length],
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                            text: '${item['_id']} ',
                            style: GoogleFonts.inter(
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              color: Colors.black,
                            ),
                          ),
                          TextSpan(
                            text: '(${item['total']})',
                            style: GoogleFonts.inter(
                              fontSize: 10,
                              color: Colors.grey.shade600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                );
              }),
            ),
          ],
        ],
      ),
    );
  }

  String formatDropdownText(String item, String label) {
    const months = {
      '1': 'Jan',
      '2': 'Feb',
      '3': 'Mar',
      '4': 'Apr',
      '5': 'May',
      '6': 'Jun',
      '7': 'Jul',
      '8': 'Aug',
      '9': 'Sep',
      '10': 'Oct',
      '11': 'Nov',
      '12': 'Dec',
    };

    if (item == 'all') {
      if (label == 'Month') return 'All';
      if (label == 'Classification') return 'All';
      if (label == 'Year') return 'All';
      return 'All';
    }

    if (label == 'Time Range') {
      return '$item months';
    }

    if (months.containsKey(item)) {
      return months[item]!;
    }

    return item[0].toUpperCase() + item.substring(1).toLowerCase();
  }

  Widget _buildDropdown({
    required String label,
    required String value,
    required List<String> items,
    required ValueChanged<String?> onChanged,
  }) {
    return ConstrainedDropdown(
      label: label,
      value: value,
      items: items,
      formatItem: formatDropdownText,
      onChanged: onChanged,
    );
  }

  Widget _kpiCard({
    required Color colorBar,
    required IconData icon,
    required Color iconBg,
    required Color iconColor,
    required String title,
    required String value,
    String? subtitleText,
    Widget? subtitleWidget,
    double valueFontSize = 20,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF3F4F6)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(height: 4, color: colorBar),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (isOverviewLoading)
                  SizedBox(
                    height: 130,
                    child: Center(
                      child: SizedBox(
                        width: 15,
                        height: 15,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.4,
                          color: Colors.blue,
                        ),
                      ),
                    ),
                  )
                else if (!isOverviewLoading) ...[
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: iconBg,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(icon, size: 18, color: iconColor),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    title,
                    style: GoogleFonts.inter(
                      fontSize: 10,
                      color: Colors.grey,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 1.1,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    value,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.inter(
                      fontSize: valueFontSize,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  if (subtitleWidget != null)
                    subtitleWidget
                  else if (subtitleText != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text(
                        subtitleText,
                        style: GoogleFonts.inter(
                          fontSize: 10,
                          color: Colors.grey,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
