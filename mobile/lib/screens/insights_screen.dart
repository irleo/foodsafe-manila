import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../services/api_service.dart';

class InsightsScreen extends StatefulWidget {
  final VoidCallback onProfilePressed;

  const InsightsScreen({super.key, required this.onProfilePressed});

  @override
  State<InsightsScreen> createState() => _InsightsScreenState();
}

class _InsightsScreenState extends State<InsightsScreen> {
  String selectedPeriod = '1Y';
  String _districtPeriod = 'Last month';
  String _diseasePeriod = 'Last month';

  String _trendDistrict = 'All districts';
  String _trendDisease = 'All diseases';

  final _trendDistricts = [
    'All districts',
    'District 1',
    'District 2',
    'District 3',
    'District 4',
    'District 5',
    'District 6',
  ];

  final _trendDiseases = [
    'All diseases',
    'Diarrhea',
    'Vomiting',
    'Nausea',
    'Fever',
    'Headache',
  ];

  List<Map<String, dynamic>> districtData = [];
  List<Map<String, dynamic>> diseaseData = [];

  bool _isDistrictLoading = true;
  bool _isDiseaseLoading = true;

  String? _districtError;
  String? _diseaseError;

  @override
  void initState() {
    super.initState();
    _loadDistrictData();
    _loadDiseaseData();
  }

  String _periodKey(String value) {
    switch (value) {
      case 'Last month':
        return 'last_month';
      case 'Last year':
        return 'last_year';
      default:
        return 'total_cumulative';
    }
  }

  int _safeInt(dynamic value) {
    if (value is int) return value;

    if (value is num) {
      return value.isFinite ? value.round() : 0;
    }

    final parsed = double.tryParse(value?.toString() ?? '');
    return parsed != null && parsed.isFinite ? parsed.round() : 0;
  }

  Future<void> _loadDistrictData() async {
    setState(() {
      _isDistrictLoading = true;
      _districtError = null;
    });

    try {
      final result = await ApiService.getInsightsDistribution(
        period: _periodKey(_districtPeriod),
      );

      final rows = result['districtData'];
      final parsed = rows is List
          ? rows.whereType<Map>().map((row) {
              return {
                'name': row['_id']?.toString() ?? 'Unknown',
                'cases': _safeInt(row['total']),
              };
            }).toList()
          : <Map<String, dynamic>>[];

      if (!mounted) return;

      setState(() {
        districtData = parsed;
        _isDistrictLoading = false;
      });
    } catch (_) {
      if (!mounted) return;

      setState(() {
        districtData = [];
        _districtError = 'Unable to load district data.';
        _isDistrictLoading = false;
      });
    }
  }

  Future<void> _loadDiseaseData() async {
    setState(() {
      _isDiseaseLoading = true;
      _diseaseError = null;
    });

    try {
      final result = await ApiService.getInsightsDistribution(
        period: _periodKey(_diseasePeriod),
      );

      final rows = result['diseaseDistribution'];
      const colors = [
        Colors.orange,
        Colors.red,
        Colors.amber,
        Colors.blue,
        Colors.deepPurple,
        Colors.cyan,
        Colors.green,
      ];

      final parsed = rows is List
          ? rows.asMap().entries.map((entry) {
              final row = entry.value as Map;

              return {
                'name': row['_id']?.toString() ?? 'Unknown',
                'cases': _safeInt(row['total']),
                'color': colors[entry.key % colors.length],
              };
            }).toList()
          : <Map<String, dynamic>>[];

      if (!mounted) return;

      setState(() {
        diseaseData = parsed;
        _isDiseaseLoading = false;
      });
    } catch (_) {
      if (!mounted) return;

      setState(() {
        diseaseData = [];
        _diseaseError = 'Unable to load disease data.';
        _isDiseaseLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            children: [
              // Header
              _buildHeader(DateTime.now()),

              Padding(
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 30),
                child: Column(
                  children: [
                    _buildOverviewCard(),

                    const SizedBox(height: 24),

                    _buildMonthlyTrend(),

                    const SizedBox(height: 24),

                    _buildDistrictSection(),

                    const SizedBox(height: 24),

                    _buildDiseaseSection(),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ----------------------------------------------------------
  // HEADER
  // ----------------------------------------------------------

  Widget _buildHeader(DateTime now) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 28),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF2563EB), Color(0xFF1D4ED8)],
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(28),
          bottomRight: Radius.circular(28),
        ),
      ),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [Image.asset('assets/foodsafe_logo.png', scale: 7)],
                ),
              ),

              // Profile button
              Material(
                color: Colors.white.withOpacity(0.18),
                shape: const CircleBorder(),
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: widget.onProfilePressed,
                  child: const Padding(
                    padding: EdgeInsets.all(10),
                    child: Icon(
                      LucideIcons.user,
                      color: Colors.white,
                      size: 22,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ------------------------------------------------------------
  // OVERVIEW
  // ------------------------------------------------------------

  Widget _buildOverviewCard() {
    return Container(
      decoration: _cardDecoration(),
      child: Column(
        children: [
          _overviewRow(
            icon: Icons.local_fire_department_outlined,
            label: 'Current Month',
            value: '1,237 cases',
            trailing: '12% vs last month',
            trailingColor: Colors.red,
          ),

          _divider(),

          _overviewRow(
            icon: Icons.calendar_month_outlined,
            label: 'Forecast',
            value: '1,280 cases',
            trailing: '3.5% · Oct 2026',
            trailingColor: Colors.red,
          ),

          _divider(),

          _overviewRow(
            icon: Icons.monitor_heart_outlined,
            label: 'Year to Date',
            value: '7,318 cases',
            trailing: 'Jan – Sep 2026',
            trailingColor: Colors.grey,
          ),

          _divider(),

          _overviewRow(
            icon: Icons.location_on_outlined,
            label: 'Top District',
            value: 'Tondo',
            trailing: '6,185 cases',
            trailingColor: Colors.grey,
          ),

          _divider(),

          _overviewRow(
            icon: Icons.medical_services_outlined,
            label: 'Top Disease',
            value: 'Diarrhea',
            trailing: '7,862 reports',
            trailingColor: Colors.grey,
            showBottomBorder: false,
          ),
        ],
      ),
    );
  }

  Widget _overviewRow({
    required IconData icon,
    required String label,
    required String value,
    required String trailing,
    required Color trailingColor,
    bool showBottomBorder = true,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: const Color(0xFF3B82F6), size: 18),
          ),

          const SizedBox(width: 14),

          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: Color(0xFF9CA3AF),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  value,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF111827),
                  ),
                ),
              ],
            ),
          ),

          if (trailingColor == Colors.red)
            Row(
              children: [
                const Icon(Icons.trending_up, color: Colors.red, size: 14),
                const SizedBox(width: 2),
                Text(
                  trailing,
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: Colors.red,
                  ),
                ),
              ],
            )
          else
            Text(
              trailing,
              style: GoogleFonts.inter(fontSize: 11, color: trailingColor),
            ),
        ],
      ),
    );
  }

  // ------------------------------------------------------------
  // MONTHLY TREND
  // ------------------------------------------------------------

  Widget _buildMonthlyTrend() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Monthly Trend',
          style: GoogleFonts.inter(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: Color(0xFF111827),
          ),
        ),

        const SizedBox(height: 10),

        Container(
          decoration: _cardDecoration(),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
                child: Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.calendar_month_outlined,
                        color: Color(0xFF3B82F6),
                        size: 18,
                      ),
                    ),

                    const SizedBox(width: 12),

                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                'Forecast',
                                style: GoogleFonts.inter(
                                  fontSize: 12,
                                  color: Color(0xFF9CA3AF),
                                ),
                              ),
                              SizedBox(width: 7),
                              _ForecastBadge(),
                            ],
                          ),
                          SizedBox(height: 3),
                          Text(
                            '1,280',
                            style: GoogleFonts.inter(
                              fontSize: 24,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF111827),
                            ),
                          ),
                          Text(
                            'estimated cases',
                            style: GoogleFonts.inter(
                              fontSize: 11,
                              color: Color(0xFF9CA3AF),
                            ),
                          ),
                        ],
                      ),
                    ),

                    Row(
                      children: [
                        Icon(Icons.trending_up, color: Colors.red, size: 16),
                        SizedBox(width: 3),
                        Text(
                          '3.5%',
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: Colors.red,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              _divider(),

              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Row(
                  children: [
                    _trendFilterButton(
                      icon: LucideIcons.mapPin,
                      label: _trendDistrict,
                      options: _trendDistricts,
                      selectedValue: _trendDistrict,
                      onSelected: (value) {
                        setState(() => _trendDistrict = value);
                      },
                    ),
                    const SizedBox(width: 8),
                    _trendFilterButton(
                      icon: LucideIcons.activity,
                      label: _trendDisease,
                      options: _trendDiseases,
                      selectedValue: _trendDisease,
                      onSelected: (value) {
                        setState(() => _trendDisease = value);
                      },
                    ),
                  ],
                ),
              ),

              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        _periodButton(
                          period: '3M',
                          selectedPeriod: selectedPeriod,
                          onSelected: (value) => selectedPeriod = value,
                        ),
                        _periodButton(
                          period: '6M',
                          selectedPeriod: selectedPeriod,
                          onSelected: (value) => selectedPeriod = value,
                        ),
                        _periodButton(
                          period: '1Y',
                          selectedPeriod: selectedPeriod,
                          onSelected: (value) => selectedPeriod = value,
                        ),
                      ],
                    ),

                    Row(
                      children: [
                        _legend(
                          color: const Color(0xFF3B82F6),
                          label: 'Official',
                        ),
                        const SizedBox(width: 10),
                        _legend(
                          color: const Color(0xFF8B5CF6),
                          label: 'Predicted',
                          dashed: true,
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              SizedBox(
                height: 150,
                child: LineChart(
                  LineChartData(
                    minY: 0,
                    maxY: 100,
                    gridData: FlGridData(
                      show: true,
                      horizontalInterval: 25,
                      drawVerticalLine: false,
                      getDrawingHorizontalLine: (value) {
                        return const FlLine(
                          color: Color(0xFFF3F4F6),
                          strokeWidth: 1,
                        );
                      },
                    ),
                    titlesData: const FlTitlesData(
                      leftTitles: AxisTitles(
                        sideTitles: SideTitles(showTitles: false),
                      ),
                      rightTitles: AxisTitles(
                        sideTitles: SideTitles(showTitles: false),
                      ),
                      topTitles: AxisTitles(
                        sideTitles: SideTitles(showTitles: false),
                      ),
                      bottomTitles: AxisTitles(
                        sideTitles: SideTitles(showTitles: false),
                      ),
                    ),
                    borderData: FlBorderData(show: false),
                    lineTouchData: LineTouchData(enabled: true),
                    lineBarsData: [
                      LineChartBarData(
                        spots: const [
                          FlSpot(0, 10),
                          FlSpot(1, 28),
                          FlSpot(2, 36),
                          FlSpot(3, 34),
                          FlSpot(4, 26),
                          FlSpot(5, 18),
                          FlSpot(6, 16),
                          FlSpot(7, 21),
                          FlSpot(8, 34),
                          FlSpot(9, 52),
                          FlSpot(10, 67),
                          FlSpot(11, 80),
                        ],
                        isCurved: true,
                        color: const Color(0xFF3B82F6),
                        barWidth: 2,
                        dotData: const FlDotData(show: false),
                      ),

                      LineChartBarData(
                        spots: const [
                          FlSpot(0, 12),
                          FlSpot(1, 32),
                          FlSpot(2, 38),
                          FlSpot(3, 35),
                          FlSpot(4, 28),
                          FlSpot(5, 21),
                          FlSpot(6, 18),
                          FlSpot(7, 28),
                          FlSpot(8, 43),
                          FlSpot(9, 55),
                          FlSpot(10, 73),
                          FlSpot(11, 82),
                        ],
                        isCurved: true,
                        color: const Color(0xFF8B5CF6),
                        barWidth: 2,
                        dotData: const FlDotData(show: false),
                        dashArray: [5, 3],
                      ),
                    ],
                  ),
                ),
              ),

              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: const [
                    _MonthLabel('Jan'),
                    _MonthLabel('Feb'),
                    _MonthLabel('Mar'),
                    _MonthLabel('Apr'),
                    _MonthLabel('May'),
                    _MonthLabel('Jun'),
                    _MonthLabel('Jul'),
                    _MonthLabel('Aug'),
                    _MonthLabel('Sep', active: true),
                    _MonthLabel('Oct', purple: true),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _periodButton({
    required String period,
    required String selectedPeriod,
    required ValueChanged<String> onSelected,
  }) {
    final selected = selectedPeriod == period;

    return GestureDetector(
      onTap: () => setState(() => onSelected(period)),
      child: Container(
        margin: const EdgeInsets.only(right: 4),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFEFF6FF) : const Color(0xFFF9FAFB),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          period,
          style: GoogleFonts.inter(
            fontSize: 11,
            fontWeight: FontWeight.w500,
            color: selected ? const Color(0xFF2563EB) : const Color(0xFF9CA3AF),
          ),
        ),
      ),
    );
  }

  Widget _legend({
    required Color color,
    required String label,
    bool dashed = false,
  }) {
    return Row(
      children: [
        SizedBox(
          width: 16,
          child: CustomPaint(
            painter: _LegendPainter(color: color, dashed: dashed),
          ),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: GoogleFonts.inter(fontSize: 10, color: Color(0xFF9CA3AF)),
        ),
      ],
    );
  }

  // ------------------------------------------------------------
  // DISTRICT
  // ------------------------------------------------------------

  Widget _buildDistrictSection() {
    return _buildDistributionSection(
      title: 'Case Distribution by District',
      period: _districtPeriod,
      data: districtData,
      isLoading: _isDistrictLoading,
      errorMessage: _districtError,
      onPeriodChanged: (value) {
        _districtPeriod = value;
        _loadDistrictData();
      },
      showColors: false,
    );
  }

  // ------------------------------------------------------------
  // DISEASES
  // ------------------------------------------------------------

  Widget _buildDiseaseSection() {
    return _buildDistributionSection(
      title: 'Disease Distribution',
      period: _diseasePeriod,
      data: diseaseData,
      isLoading: _isDiseaseLoading,
      errorMessage: _diseaseError,
      onPeriodChanged: (value) {
        _diseasePeriod = value;
        _loadDiseaseData();
      },
      showColors: true,
    );
  }

  Widget _buildDistributionSection({
    required String title,
    required String period,
    required List<Map<String, dynamic>> data,
    required bool isLoading,
    required String? errorMessage,
    required ValueChanged<String> onPeriodChanged,
    required bool showColors,
  }) {
    final maxCases = data.isEmpty
        ? 1
        : data
            .map((item) => item['cases'] as int)
            .fold<int>(0, (max, value) => value > max ? value : max);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: GoogleFonts.inter(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 10),
        Container(
          decoration: _cardDecoration(),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
                child: Row(
                  children: [
                    _periodButton(
                      period: 'Last month',
                      selectedPeriod: period,
                      onSelected: onPeriodChanged,
                    ),
                    _periodButton(
                      period: 'Last year',
                      selectedPeriod: period,
                      onSelected: onPeriodChanged,
                    ),
                    _periodButton(
                      period: 'Total cumulative',
                      selectedPeriod: period,
                      onSelected: onPeriodChanged,
                    ),
                  ],
                ),
              ),
              _divider(),
              if (isLoading)
                const Padding(
                  padding: EdgeInsets.all(24),
                  child: CircularProgressIndicator(
                    color: Color(0xFF2563EB),
                  ),
                )
              else if (errorMessage != null)
                Padding(
                  padding: const EdgeInsets.all(20),
                  child: Text(
                    errorMessage,
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      color: Colors.red,
                    ),
                  ),
                )
              else if (data.isEmpty)
                Padding(
                  padding: const EdgeInsets.all(20),
                  child: Text(
                    'No data available for this period.',
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      color: Color(0xFF9CA3AF),
                    ),
                  ),
                )
              else
                ...data.asMap().entries.map((entry) {
                  final index = entry.key;
                  final item = entry.value;
                  final cases = item['cases'] as int;
                  final percentage = maxCases > 0 ? cases / maxCases : 0.0;
                  final color =
                      item['color'] as Color? ?? const Color(0xFF3B82F6);

                  return Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                        child: Row(
                          children: [
                            if (showColors) ...[
                              Container(
                                width: 10,
                                height: 10,
                                decoration: BoxDecoration(
                                  color: color,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 8),
                            ],
                            SizedBox(
                              width: showColors ? 90 : 80,
                              child: Text(
                                item['name'].toString(),
                                style: GoogleFonts.inter(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                  color: const Color(0xFF374151),
                                ),
                              ),
                            ),
                            Expanded(
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(10),
                                child: LinearProgressIndicator(
                                  value: percentage,
                                  minHeight: 8,
                                  backgroundColor: const Color(0xFFF3F4F6),
                                  valueColor: AlwaysStoppedAnimation(
                                    showColors
                                        ? color.withOpacity(.75)
                                        : const Color(0xFF3B82F6),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            SizedBox(
                              width: 42,
                              child: Text(
                                _formatNumber(cases),
                                textAlign: TextAlign.right,
                                style: GoogleFonts.inter(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                  color: const Color(0xFF374151),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (index < data.length - 1) _divider(),
                    ],
                  );
                }),
              if (!isLoading && data.isNotEmpty) const SizedBox(height: 6),
            ],
          ),
        ),
      ],
    );
  }

  // ------------------------------------------------------------
  // UNDERSTANDING DATA
  // ------------------------------------------------------------

  Widget _buildUnderstandingSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Understanding Your Data',
          style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600),
        ),

        const SizedBox(height: 10),

        Container(
          decoration: _cardDecoration(),
          child: Column(
            children: [
              _infoRow(
                title: 'Predictions',
                description:
                    'AI forecasts use historical data and seasonal patterns to estimate future cases for resource planning.',
                showDivider: true,
              ),

              _infoRow(
                title: 'Geographic Patterns',
                description:
                    'District data identifies hotspots where cases cluster, enabling targeted health responses.',
                showDivider: true,
              ),

              _infoRow(
                title: 'Disease Trends',
                description:
                    'Tracking Disease frequency helps detect outbreaks early and allocate medical resources effectively.',
                showDivider: false,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _infoRow({
    required String title,
    required String description,
    required bool showDivider,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: showDivider
            ? const Border(bottom: BorderSide(color: Color(0xFFF3F4F6)))
            : null,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.lightbulb_outline,
              color: Color(0xFF3B82F6),
              size: 18,
            ),
          ),

          const SizedBox(width: 14),

          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF111827),
                  ),
                ),

                const SizedBox(height: 3),

                Text(
                  description,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    height: 1.4,
                    color: Color(0xFF9CA3AF),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ------------------------------------------------------------
  // HELPERS
  // ------------------------------------------------------------

  BoxDecoration _cardDecoration() {
    return BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: const Color(0xFFF3F4F6)),
    );
  }

  Widget _divider() {
    return const Divider(height: 1, thickness: 1, color: Color(0xFFF3F4F6));
  }

  String _formatNumber(int number) {
    return number.toString().replaceAllMapped(
      RegExp(r'(\d)(?=(\d{3})+(?!\d))'),
      (match) => '${match[1]},',
    );
  }

  Widget _trendFilterButton({
    required IconData icon,
    required String label,
    required List<String> options,
    required String selectedValue,
    required ValueChanged<String> onSelected,
  }) {
    final isSelected = selectedValue != options.first;

    return GestureDetector(
      onTap: () async {
        final selected = await showModalBottomSheet<String>(
          context: context,
          backgroundColor: Colors.white,
          shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          builder: (context) {
            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 36,
                      height: 4,
                      decoration: BoxDecoration(
                        color: const Color(0xFFD1D5DB),
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                    const SizedBox(height: 16),
                    ...options.map(
                      (option) => ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(
                          option,
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        trailing: option == selectedValue
                            ? const Icon(
                                Icons.check,
                                color: Color(0xFF2563EB),
                              )
                            : null,
                        onTap: () => Navigator.pop(context, option),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );

        if (selected != null) {
          onSelected(selected);
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected
              ? const Color(0xFFEFF6FF)
              : const Color(0xFFF9FAFB),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 14,
              color: isSelected
                  ? const Color(0xFF2563EB)
                  : const Color(0xFF9CA3AF),
            ),
            const SizedBox(width: 5),
            Text(
              label,
              style: GoogleFonts.inter(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: isSelected
                    ? const Color(0xFF2563EB)
                    : const Color(0xFF9CA3AF),
              ),
            ),
            const SizedBox(width: 3),
            const Icon(
              LucideIcons.chevronDown,
              size: 13,
              color: Color(0xFF9CA3AF),
            ),
          ],
        ),
      ),
    );
  }
}

// ------------------------------------------------------------
// SMALL WIDGETS
// ------------------------------------------------------------

class _ForecastBadge extends StatelessWidget {
  const _ForecastBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0xFFF5F3FF),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        'Oct 2026',
        style: GoogleFonts.inter(
          fontSize: 10,
          fontWeight: FontWeight.w500,
          color: Color(0xFF7C3AED),
        ),
      ),
    );
  }
}

class _MonthLabel extends StatelessWidget {
  final String text;
  final bool active;
  final bool purple;

  const _MonthLabel(this.text, {this.active = false, this.purple = false});

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: GoogleFonts.inter(
        fontSize: 9,
        fontWeight: FontWeight.w500,
        color: active
            ? const Color(0xFF3B82F6)
            : purple
            ? const Color(0xFFA78BFA)
            : const Color(0xFF9CA3AF),
      ),
    );
  }
}

class _LegendPainter extends CustomPainter {
  final Color color;
  final bool dashed;

  _LegendPainter({required this.color, required this.dashed});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 2;

    if (!dashed) {
      canvas.drawLine(
        Offset(0, size.height / 2),
        Offset(size.width, size.height / 2),
        paint,
      );
      return;
    }

    const dashWidth = 4.0;
    const gap = 2.0;

    double x = 0;

    while (x < size.width) {
      canvas.drawLine(
        Offset(x, size.height / 2),
        Offset((x + dashWidth).clamp(0, size.width), size.height / 2),
        paint,
      );

      x += dashWidth + gap;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) {
    return false;
  }
}
