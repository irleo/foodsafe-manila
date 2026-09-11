import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../services/api_service.dart';

class InsightsScreen extends StatefulWidget {
  final VoidCallback onProfilePressed;

  const InsightsScreen({super.key, required this.onProfilePressed});

  @override
  State<InsightsScreen> createState() => InsightsScreenState();
}

class InsightsScreenState extends State<InsightsScreen> {
  String selectedPeriod = '3M';
  String _districtPeriod = 'Last 7 days';
  String _diseasePeriod = 'Last 7 days';

  String _trendDistrict = 'All districts';
  String _trendDisease = 'Typhoid and Paratyphoid';

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
    'Typhoid and Paratyphoid',
    'Rotavirus',
    'Cholera',
    'Acute Bloody Diarrhea',
  ];

  Map<String, dynamic>? _overview;
  List<Map<String, dynamic>> districtData = [];
  List<Map<String, dynamic>> diseaseData = [];

  bool _isOverviewLoading = true;
  bool _isDistrictLoading = true;
  bool _isDiseaseLoading = true;

  String? _districtError;
  String? _diseaseError;

  List<Map<String, dynamic>> _forecastRows = [];

  bool _isForecastLoading = true;
  String? _forecastError;

  @override
  void initState() {
    super.initState();
    _loadOverviewData();
    _loadForecastData();
    _loadDistrictData();
    _loadDiseaseData();
  }

  Future<void> refreshData() async {
    await Future.wait([
      _loadOverviewData(),
      _loadForecastData(),
      _loadDistrictData(),
      _loadDiseaseData(),
    ]);
  }

  String _periodKey(String value) {
    switch (value) {
      case 'Last 7 days':
        return 'last_7_days';
      case 'Last 28 days':
        return 'last_28_days';
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

  int? _safeIntNullable(dynamic value) {
    if (value == null || value == '') return null;

    if (value is int) return value;

    if (value is num) {
      return value.isFinite ? value.round() : null;
    }

    final parsed = double.tryParse(value.toString());

    return parsed != null && parsed.isFinite ? parsed.round() : null;
  }

  double? _safeDouble(dynamic value) {
    if (value == null || value == '') return null;

    final number = value is num
        ? value.toDouble()
        : double.tryParse(value.toString());

    return number != null && number.isFinite ? number : null;
  }

  List<dynamic> _series(Map<String, dynamic> source, List<String> keys) {
    for (final key in keys) {
      final value = source[key];
      if (value is List) return value;
    }
    return const [];
  }

  Map<String, dynamic>? _prophetScope(Map<String, dynamic> district) {
    final models = district['models'];

    if (models is Map && models['prophet'] is Map) {
      return Map<String, dynamic>.from(models['prophet'] as Map);
    }

    // Supports the older response format where Prophet fields are
    // directly on the district object.
    if (models == null) {
      return district;
    }

    return null;
  }

  void _mergeForecastMonth(
    Map<String, Map<String, dynamic>> merged,
    int year,
    int month, {
    double? actual,
    double? predicted,
    double? lower,
    double? upper,
    bool isForecast = false,
  }) {
    if (year < 1 || month < 1 || month > 12) return;

    final key = '$year-$month';

    final row = merged.putIfAbsent(
      key,
      () => {
        'year': year,
        'month': month,
        'actual': null,
        'predicted': null,
        'lower': null,
        'upper': null,
        'isForecast': false,
      },
    );

    if (actual != null) {
      row['actual'] = (row['actual'] as double? ?? 0) + actual;
    }

    if (predicted != null) {
      row['predicted'] = (row['predicted'] as double? ?? 0) + predicted;
    }

    if (lower != null) row['lower'] = lower;
    if (upper != null) row['upper'] = upper;
    if (isForecast) row['isForecast'] = true;
  }

  List<Map<String, dynamic>> _visibleForecastRows() {
    if (_forecastRows.isEmpty) return [];

    final rangeMonths = switch (selectedPeriod) {
      '3M' => 3,
      '6M' => 6,
      _ => 12,
    };

    final rows = [..._forecastRows];

    final lastRow = rows.lastWhere(
      (row) => row['predicted'] != null,
      orElse: () => rows.last,
    );

    final endDate = DateTime(lastRow['year'] as int, lastRow['month'] as int);

    return rows.where((row) {
      final rowDate = DateTime(row['year'] as int, row['month'] as int);

      final difference =
          (endDate.year - rowDate.year) * 12 + endDate.month - rowDate.month;

      return difference >= 0 && difference <= rangeMonths;
    }).toList();
  }

  List<Map<String, dynamic>> _buildForecastRows(List<dynamic> districts) {
    final merged = <String, Map<String, dynamic>>{};

    for (final rawDistrict in districts) {
      if (rawDistrict is! Map) continue;

      final district = Map<String, dynamic>.from(rawDistrict);
      final scope = _prophetScope(district);
      if (scope == null) continue;

      final history = _series(district, [
        'historicalSeries',
        'historySeries',
        'actualSeries',
        'history',
      ]);

      final backtest = _series(scope, [
        'backtestSeries',
        'validationSeries',
        'inSampleSeries',
      ]);

      final forecast = _series(scope, [
        'forecast',
        'forecastSeries',
        'predictedSeries',
        'predictionSeries',
        'forecasts',
      ]);

      for (final rawRow in history) {
        if (rawRow is! Map) continue;

        final row = Map<String, dynamic>.from(rawRow);
        final year = _safeInt(row['year']);
        final month = _safeInt(row['month']);

        if (year == 0 || month == 0) continue;

        _mergeForecastMonth(
          merged,
          year,
          month,
          actual: _safeDouble(
            row['cases'] ?? row['actualCases'] ?? row['actual'],
          ),
        );
      }

      for (final rawRow in backtest) {
        if (rawRow is! Map) continue;

        final row = Map<String, dynamic>.from(rawRow);
        final year = _safeInt(row['year']);
        final month = _safeInt(row['month']);

        if (year == 0 || month == 0) continue;

        _mergeForecastMonth(
          merged,
          year,
          month,
          predicted: _safeDouble(row['predictedCases'] ?? row['predicted']),
          lower: _safeDouble(row['lowerBound'] ?? row['lower']),
          upper: _safeDouble(row['upperBound'] ?? row['upper']),
        );
      }

      final forecastRows = forecast.whereType<Map>();

      for (final rawRow in forecastRows) {
        final row = Map<String, dynamic>.from(rawRow);

        if (row['isPrimaryTarget'] != true && forecast.length > 1) {
          continue;
        }

        final year = _safeInt(row['year'] ?? row['targetYear']);
        final month = _safeInt(row['month'] ?? row['targetMonth']);

        if (year == 0 || month == 0) continue;

        _mergeForecastMonth(
          merged,
          year,
          month,
          predicted: _safeDouble(row['predictedCases'] ?? row['predicted']),
          lower: _safeDouble(row['lowerBound'] ?? row['lower']),
          upper: _safeDouble(row['upperBound'] ?? row['upper']),
          isForecast: true,
        );
      }

      if (forecast.isEmpty && scope['nextForecast'] is Map) {
        final row = Map<String, dynamic>.from(scope['nextForecast'] as Map);
        final year = _safeInt(row['year'] ?? row['targetYear']);
        final month = _safeInt(row['month'] ?? row['targetMonth']);

        if (year > 0 && month > 0) {
          _mergeForecastMonth(
            merged,
            year,
            month,
            predicted: _safeDouble(row['predictedCases'] ?? row['predicted']),
            lower: _safeDouble(row['lowerBound'] ?? row['lower']),
            upper: _safeDouble(row['upperBound'] ?? row['upper']),
            isForecast: true,
          );
        }
      }
    }

    final rows = merged.values.toList()
      ..sort((a, b) {
        final aDate = DateTime(a['year'] as int, a['month'] as int);
        final bDate = DateTime(b['year'] as int, b['month'] as int);
        return aDate.compareTo(bDate);
      });

    return rows;
  }

  Future<void> _loadForecastData() async {
    setState(() {
      _isForecastLoading = true;
      _forecastError = null;
    });

    try {
      final result = await ApiService.fetchLatestPredictions();

      if (result['hasPrediction'] != true) {
        if (!mounted) return;

        setState(() {
          _forecastRows = [];
          _isForecastLoading = false;
          _forecastError =
              result['message']?.toString() ??
              'No saved forecast is available yet.';
        });
        return;
      }

      final payload = result['payload'];

      final diseases = payload is Map && payload['diseases'] is List
          ? payload['diseases'] as List
          : <dynamic>[];

      final availableDiseases = diseases
          .whereType<Map>()
          .map((item) => item['disease']?.toString())
          .whereType<String>()
          .toList();

      if (availableDiseases.isNotEmpty &&
          !availableDiseases.contains(_trendDisease)) {
        _trendDisease = availableDiseases.first;
      }

      if (diseases.isEmpty) {
        if (!mounted) return;

        setState(() {
          _forecastRows = [];
          _forecastError = 'No disease forecast data is available yet.';
          _isForecastLoading = false;
        });
        return;
      }

      Map<String, dynamic>? selectedDiseasePayload;

      final matchingDisease = diseases.firstWhere(
        (item) => item is Map && item['disease']?.toString() == _trendDisease,
        orElse: () => null,
      );

      if (matchingDisease is Map) {
        selectedDiseasePayload = Map<String, dynamic>.from(matchingDisease);
      }

      final districts = selectedDiseasePayload?['districts'] is List
          ? selectedDiseasePayload!['districts'] as List
          : <dynamic>[];

      final selectedDistricts = _trendDistrict == 'All districts'
          ? districts
          : districts.where((district) {
              if (district is! Map) return false;

              final value = district['district'] ?? district['districtKey'];

              return value?.toString() == _trendDistrict;
            }).toList();

      final rows = _buildForecastRows(selectedDistricts);

      if (!mounted) return;

      setState(() {
        _forecastRows = rows;
        _isForecastLoading = false;
      });
    } catch (_) {
      if (!mounted) return;

      setState(() {
        _forecastRows = [];
        _forecastError = 'Unable to load forecast data.';
        _isForecastLoading = false;
      });
    }
  }

  Future<void> _loadOverviewData() async {
    setState(() {
      _isOverviewLoading = true;
    });

    try {
      final result = await ApiService.getInsightsDistribution(
        period: 'total_cumulative',
      );

      if (!mounted) return;

      final overview = result['overview'];

      setState(() {
        _overview = overview is Map
            ? Map<String, dynamic>.from(overview)
            : null;

        _isOverviewLoading = false;

        if (_overview == null) {
        }
      });
    } catch (_) {
      if (!mounted) return;

      setState(() {
        _overview = null;
        _isOverviewLoading = false;
      });
    }
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
        child: RefreshIndicator(
          onRefresh: refreshData,
          color: const Color(0xFF2563EB),
          child: SingleChildScrollView(
            child: Column(
              children: [
                // Header
                _buildHeader(DateTime.now()),

                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 20, 16, 30),
                  child: Column(
                    children: [
                      _buildOverviewCard(title: 'Summary'),

                      const SizedBox(height: 24),

                      _buildForecast(),

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
        color: Color(0xFF134c8c),
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
                color: Colors.white.withValues(alpha: 0.18),
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

  Widget _buildOverviewCard({required String title}) {
    final overview = _overview;
    final currentMonthCases = _safeIntNullable(overview?['currentMonthCases']);
    final cumulativeCases = _safeIntNullable(overview?['cumulativeCases']);
    final topDistrict = overview?['topDistrict'];
    final topDisease = overview?['topDisease'];

    final isLoading = _isOverviewLoading;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 10),
        Container(
          decoration: _cardDecoration(),
          child: Column(
            children: [
              isLoading
                  ? _overviewSkeletonRow()
                  : _overviewRow(
                      icon: LucideIcons.flame,
                      label: 'Current Month',
                      value: currentMonthCases == null
                          ? '—'
                          : '${_formatNumber(currentMonthCases)} cases',
                      trailing: _formatSignedPercent(overview?['monthlyChange']),
                      trailingColor: const Color(0xFF9CA3AF),
                      trailingWidget: _buildChangeIndicator(
                        overview?['monthlyChange'],
                      ),
                    ),

              _divider(),

              isLoading
                  ? _overviewSkeletonRow()
                  : _overviewRow(
                      icon: LucideIcons.activity,
                      label: 'Total Cumulative',
                      value: cumulativeCases == null
                          ? '—'
                          : '${_formatNumber(cumulativeCases)} cases',
                      trailing: _formatCoverageRange(
                        overview?['coverageStart'],
                        overview?['coverageEnd'],
                      ),
                      trailingColor: Colors.grey,
                    ),

              _divider(),

              isLoading
                  ? _overviewSkeletonRow()
                  : _overviewRow(
                      icon: LucideIcons.mapPin,
                      label: 'Most District',
                      value: topDistrict is Map
                          ? topDistrict['name']?.toString() ?? '—'
                          : '—',
                      trailing: topDistrict is Map
                          ? '${_formatNumber(_safeInt(topDistrict['cases']))} cases'
                          : '—',
                      trailingColor: Colors.grey,
                    ),

              _divider(),

              isLoading
                  ? _overviewSkeletonRow(showBottomBorder: false)
                  : _overviewRow(
                      icon: LucideIcons.stethoscope,
                      label: 'Most Disease',
                      value: topDisease is Map
                          ? topDisease['name']?.toString() ?? '—'
                          : '—',
                      trailing: topDisease is Map
                          ? '${_formatNumber(_safeInt(topDisease['cases']))} cases'
                          : '—',
                      trailingColor: Colors.grey,
                      showBottomBorder: false,
                    ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _overviewRow({
    required IconData icon,
    required String label,
    required String value,
    required String trailing,
    required Color trailingColor,
    Widget? trailingWidget,
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

          trailingWidget ??
              Text(
                trailing,
                style: GoogleFonts.inter(fontSize: 11, color: trailingColor),
              ),
        ],
      ),
    );
  }

  Widget _overviewSkeletonRow({bool showBottomBorder = true}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      child: Row(
        children: [
          _buildSkeleton(width: 36, height: 36, borderRadius: 12),

          const SizedBox(width: 14),

          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildSkeleton(width: 85, height: 12, borderRadius: 4),
                const SizedBox(height: 6),
                _buildSkeleton(width: 120, height: 14, borderRadius: 4),
              ],
            ),
          ),

          const SizedBox(width: 12),

          _buildSkeleton(width: 75, height: 12, borderRadius: 4),
        ],
      ),
    );
  }

  // ------------------------------------------------------------
  // FORECAST
  // ------------------------------------------------------------

  Widget _buildForecast() {
    final forecast = _primaryForecast();
    final forecastCases = _safeInt(forecast?['predicted']);
    final forecastDate = forecast == null ? '—' : _formatMonthYear(forecast);
    final selectedDistrictLabel = _trendDistrict == 'All districts'
        ? 'All District'
        : _trendDistrict;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Forecast',
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
                child: _isForecastLoading
                    ? Row(
                        children: [
                          _buildSkeleton(
                            width: 36,
                            height: 36,
                            borderRadius: 12,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    _buildSkeleton(width: 90, height: 12),
                                    const SizedBox(width: 7),
                                    _buildSkeleton(
                                      width: 55,
                                      height: 18,
                                      borderRadius: 6,
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                _buildSkeleton(width: 80, height: 24),
                                const SizedBox(height: 4),
                                _buildSkeleton(width: 130, height: 11),
                              ],
                            ),
                          ),
                        ],
                      )
                    : Row(
                        children: [
                          Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              color: const Color(0xFFEFF6FF),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(
                              LucideIcons.calendar,
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
                                      selectedDistrictLabel,
                                      style: GoogleFonts.inter(
                                        fontSize: 12,
                                        color: const Color(0xFF9CA3AF),
                                      ),
                                    ),
                                    const SizedBox(width: 7),
                                    _ForecastBadge(label: forecastDate),
                                  ],
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  forecast == null
                                      ? '—'
                                      : _formatNumber(forecastCases),
                                  style: GoogleFonts.inter(
                                    fontSize: 24,
                                    fontWeight: FontWeight.w600,
                                    color: const Color(0xFF111827),
                                  ),
                                ),
                                Text(
                                  'predicted eligible cases',
                                  style: GoogleFonts.inter(
                                    fontSize: 11,
                                    color: const Color(0xFF9CA3AF),
                                  ),
                                ),
                              ],
                            ),
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
                        _loadForecastData();
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
                        _loadForecastData();
                      },
                    ),
                  ],
                ),
              ),

              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
                child: Row(
                  children: [
                    Row(
                      children: [
                        _periodButton(
                          period: '3M',
                          selectedPeriod: selectedPeriod,
                          onSelected: (value) {
                            setState(() => selectedPeriod = value);
                          },
                        ),
                        _periodButton(
                          period: '6M',
                          selectedPeriod: selectedPeriod,
                          onSelected: (value) {
                            setState(() => selectedPeriod = value);
                          },
                        ),
                        _periodButton(
                          period: '1Y',
                          selectedPeriod: selectedPeriod,
                          onSelected: (value) {
                            setState(() => selectedPeriod = value);
                          },
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              _buildForecastChart(),

              Padding(
                padding: EdgeInsetsGeometry.fromLTRB(16, 12, 16, 16),
                child: Wrap(
                  alignment: WrapAlignment.center,
                  spacing: 4,
                  runSpacing: 8,
                  children: [
                    _legend(
                      color: const Color(0xFF3B82F6),
                      label: 'Historical Eligible',
                    ),
                    const SizedBox(width: 10),
                    _legend(
                      color: const Color(0xFF8B5CF6),
                      label: 'Historical Prediction',
                      dashed: true,
                    ),
                    const SizedBox(width: 10),
                    _legend(color: const Color(0xFF8B5CF6), label: 'Forecast'),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildForecastChart() {
    if (_isForecastLoading) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: _buildSkeleton(
          width: double.infinity,
          height: 150,
          borderRadius: 8,
        ),
      );
    }

    if (_forecastError != null) {
      return Padding(
        padding: const EdgeInsets.all(20),
        child: Text(
          _forecastError!,
          style: GoogleFonts.inter(fontSize: 13, color: Colors.red),
        ),
      );
    }

    final rows = _visibleForecastRows();

    if (rows.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(20),
        child: Text(
          'No predictive data available.',
          style: GoogleFonts.inter(fontSize: 13, color: Color(0xFF9CA3AF)),
        ),
      );
    }

    final actualSpots = <FlSpot>[];
    final predictionSpots = <FlSpot>[];
    final forecastSpots = <FlSpot>[];

    int? forecastIndex;

    for (var index = 0; index < rows.length; index++) {
      final row = rows[index];
      final actual = _safeDouble(row['actual']);
      final predicted = _safeDouble(row['predicted']);
      final x = index.toDouble();

      if (actual != null) {
        actualSpots.add(FlSpot(x, actual));
      }

      if (predicted != null && row['isForecast'] != true) {
        predictionSpots.add(FlSpot(x, predicted));
      }

      if (predicted != null && row['isForecast'] == true) {
        forecastIndex = index;
      }
    }

    if (forecastIndex != null) {
      final targetIndex = forecastIndex;
      final target = rows[targetIndex];

      final targetPredicted = _safeDouble(target['predicted']);

      if (targetPredicted != null) {
        var anchorIndex = targetIndex - 1;

        while (anchorIndex >= 0 && rows[anchorIndex]['isForecast'] == true) {
          anchorIndex--;
        }

        if (anchorIndex >= 0) {
          final anchor = rows[anchorIndex];
          final anchorValue =
              _safeDouble(anchor['actual']) ?? _safeDouble(anchor['predicted']);

          if (anchorValue != null) {
            forecastSpots.add(FlSpot(anchorIndex.toDouble(), anchorValue));
          }
        }

        forecastSpots.add(FlSpot(targetIndex.toDouble(), targetPredicted));
      }
    }

    final allValues = [
      ...actualSpots.map((spot) => spot.y),
      ...predictionSpots.map((spot) => spot.y),
      ...forecastSpots.map((spot) => spot.y),
    ];

    final maxValue = allValues.isEmpty
        ? 100.0
        : allValues.reduce((a, b) => a > b ? a : b);

    final monthLabels = rows.map((row) {
      return _monthLabel(row['month'] as int, row['year'] as int);
    }).toList();

    return Container(
      height: 150,
      padding: EdgeInsets.symmetric(horizontal: 16),
      child: LineChart(
        LineChartData(
          minX: 0,
          maxX: rows.length > 1 ? (rows.length - 1).toDouble() : 1,
          minY: 0,
          maxY: maxValue == 0 ? 100 : maxValue * 1.15,
          gridData: FlGridData(
            show: true,
            drawVerticalLine: false,
            getDrawingHorizontalLine: (_) =>
                const FlLine(color: Color(0xFFF3F4F6), strokeWidth: 1),
          ),
          titlesData: FlTitlesData(
            leftTitles: const AxisTitles(
              sideTitles: SideTitles(showTitles: false),
            ),
            rightTitles: const AxisTitles(
              sideTitles: SideTitles(showTitles: false),
            ),
            topTitles: const AxisTitles(
              sideTitles: SideTitles(showTitles: false),
            ),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 36,
                interval: monthLabels.length > 8 ? 2 : 1,
                getTitlesWidget: (value, meta) {
                  final index = value.round();

                  if (value != index.toDouble() ||
                      index < 0 ||
                      index >= monthLabels.length) {
                    return const SizedBox.shrink();
                  }

                  final labelInterval = monthLabels.length > 8 ? 2 : 1;

                  if (index % labelInterval != 0 &&
                      index != monthLabels.length - 1) {
                    return const SizedBox.shrink();
                  }

                  final row = rows[index];
                  final isForecast = rows[index]['isForecast'] == true;

                  return SideTitleWidget(
                    meta: meta,
                    fitInside: SideTitleFitInsideData(
                      enabled: true,
                      distanceFromEdge: 0,
                      axisPosition: meta.axisPosition,
                      parentAxisSize: meta.parentAxisSize,
                    ),
                    child: Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                            text: monthLabels[index],
                            style: GoogleFonts.inter(),
                          ),
                          TextSpan(
                            text: '\n${row['year']}',
                            style: GoogleFonts.inter(fontSize: 8),
                          ),
                        ],
                      ),
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      softWrap: true,
                      style: GoogleFonts.inter(
                        fontSize: 9,
                        height: 1.15,
                        fontWeight: FontWeight.w500,
                        color: isForecast
                            ? const Color(0xFFA78BFA)
                            : const Color(0xFF9CA3AF),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
          borderData: FlBorderData(show: false),
          lineTouchData: LineTouchData(enabled: true),
          lineBarsData: [
            LineChartBarData(
              spots: actualSpots,
              isCurved: true,
              color: const Color(0xFF3B82F6),
              barWidth: 2,
              dotData: const FlDotData(show: false),
            ),
            LineChartBarData(
              spots: predictionSpots,
              isCurved: true,
              color: const Color(0xFF8B5CF6),
              barWidth: 2,
              dashArray: [5, 3],
              dotData: const FlDotData(show: false),
            ),
            LineChartBarData(
              spots: forecastSpots,
              isCurved: true,
              color: const Color(0xFF8B5CF6),
              barWidth: 2,
              dotData: const FlDotData(show: false),
            ),
          ],
        ),
      ),
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

  String _monthLabel(int month, int year) {
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

    if (month < 1 || month > 12) {
      return '$year';
    }

    return months[month - 1];
  }

  Widget _legend({
    required Color color,
    required String label,
    bool dashed = false,
  }) {
    return Row(
      mainAxisSize: MainAxisSize.min,
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
          style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600),
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
                      period: 'Last 7 days',
                      selectedPeriod: period,
                      onSelected: onPeriodChanged,
                    ),
                    _periodButton(
                      period: 'Last 28 days',
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
                _buildDistributionSkeleton(showColors: showColors)
              else if (errorMessage != null)
                Padding(
                  padding: const EdgeInsets.all(20),
                  child: Text(
                    errorMessage,
                    style: GoogleFonts.inter(fontSize: 13, color: Colors.red),
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
                                        ? color.withValues(alpha: .75)
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

  Widget _buildDistributionSkeleton({required bool showColors}) {
    return Column(
      children: List.generate(
        6,
        (index) => Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
              child: Row(
                children: [
                  if (showColors) ...[
                    _buildSkeleton(width: 10, height: 10, borderRadius: 5),
                    const SizedBox(width: 8),
                  ],

                  _buildSkeleton(
                    width: showColors ? 90 : 80,
                    height: 12,
                    borderRadius: 4,
                  ),

                  const SizedBox(width: 10),

                  Expanded(
                    child: _buildSkeleton(
                      width: double.infinity,
                      height: 8,
                      borderRadius: 10,
                    ),
                  ),

                  const SizedBox(width: 10),

                  _buildSkeleton(width: 42, height: 12, borderRadius: 4),
                ],
              ),
            ),

            if (index < 5) _divider(),
          ],
        ),
      ),
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
              LucideIcons.lightbulb,
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
                                LucideIcons.check,
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
          color: isSelected ? const Color(0xFFEFF6FF) : const Color(0xFFF9FAFB),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            /* Icon(
              icon,
              size: 14,
              color: isSelected
                  ? const Color(0xFF2563EB)
                  : const Color(0xFF9CA3AF),
            ),
            const SizedBox(width: 5), */
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
            Icon(
              LucideIcons.chevronDown,
              size: 13,
              color: isSelected
                  ? const Color(0xFF2563EB)
                  : const Color(0xFF9CA3AF),
            ),
          ],
        ),
      ),
    );
  }

  String _formatMonthYear(dynamic value) {
    if (value is! Map) return '—';

    final month = _safeInt(value['month']);
    final year = _safeInt(value['year']);

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

    if (month < 1 || month > 12 || year == 0) return '—';

    return '${months[month - 1]} $year';
  }

  String _formatCoverageRange(dynamic start, dynamic end) {
    final startLabel = _formatMonthYear(start);
    final endLabel = _formatMonthYear(end);

    if (startLabel == '—' || endLabel == '—') return '—';

    return '$startLabel – $endLabel';
  }

  String _formatSignedPercent(dynamic value) {
    final percent = _safeDouble(value);

    if (percent == null) return '—';
    if (percent == 0) return '0.0% vs last month';

    final sign = percent > 0 ? '+' : '';
    return '$sign${percent.toStringAsFixed(1)}% vs last month';
  }

  Widget _buildChangeIndicator(dynamic value) {
    final percent = _safeDouble(value);
    if (percent == null) {
      return Text(
        '—',
        style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF9CA3AF)),
      );
    }
    Color color;
    IconData icon;
    if (percent > 0) {
      color = Colors.red;
      icon = LucideIcons.trendingUp;
    } else if (percent < 0) {
      color = Colors.green;
      icon = LucideIcons.trendingDown;
    } else {
      color = const Color(0xFF9CA3AF);
      icon = LucideIcons.minus;
    }
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: color, size: 14),
        const SizedBox(width: 2),
        Text(
          _formatSignedPercent(percent),
          style: GoogleFonts.inter(
            fontSize: 11,
            fontWeight: FontWeight.w500,
            color: color,
          ),
        ),
      ],
    );
  }

  Map<String, dynamic>? _primaryForecast() {
    final rows = _visibleForecastRows();

    for (final row in rows.reversed) {
      if (row['isForecast'] == true && row['predicted'] != null) {
        return row;
      }
    }

    return null;
  }

  Widget _buildSkeleton({
    required double width,
    required double height,
    double borderRadius = 6,
  }) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: const Color(0xFFF3F4F6),
        borderRadius: BorderRadius.circular(borderRadius),
      ),
    );
  }
}

// ------------------------------------------------------------
// SMALL WIDGETS
// ------------------------------------------------------------

class _ForecastBadge extends StatelessWidget {
  final String label;

  const _ForecastBadge({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0xFFF5F3FF),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: GoogleFonts.inter(
          fontSize: 10,
          fontWeight: FontWeight.w500,
          color: const Color(0xFF7C3AED),
        ),
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
