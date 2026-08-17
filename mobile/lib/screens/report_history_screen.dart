import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../services/api_service.dart';
import '../services/session.dart';
import '../utils/format_helpers.dart';
import '../widgets/app_loading.dart';

class ReportHistoryScreen extends StatefulWidget {
  const ReportHistoryScreen({super.key});

  @override
  State<ReportHistoryScreen> createState() => _ReportHistoryScreenState();
}

class _ReportHistoryScreenState extends State<ReportHistoryScreen> {
  List<Map<String, dynamic>> _reports = [];
  bool _isLoading = true;

  int _currentPage = 0;
  final int _itemsPerPage = 10;
  int _totalReportCount = 0;
  int _serverTotalPages = 1;
  final ScrollController _scrollController = ScrollController();
  bool _showPagination = false;
  bool _showFirstPageInput = false;
  bool _showSecondPageInput = false;
  final TextEditingController _pageController = TextEditingController();
  final FocusNode _pageFocusNode = FocusNode();
  final TextEditingController _pageController2 = TextEditingController();
  final FocusNode _pageFocusNode2 = FocusNode();

  @override
  void initState() {
    super.initState();
    _fetchReports();

    _pageFocusNode.addListener(() {
      if (!_pageFocusNode.hasFocus && _showFirstPageInput) {
        setState(() {
          _showFirstPageInput = false;
        });
        _pageController.clear();
      }
    });

    _pageFocusNode2.addListener(() {
      if (!_pageFocusNode2.hasFocus && _showSecondPageInput) {
        setState(() {
          _showSecondPageInput = false;
        });
        _pageController2.clear();
      }
    });

    _scrollController.addListener(() {
      if (_scrollController.position.pixels ==
          _scrollController.position.maxScrollExtent) {
        if (!_showPagination) {
          setState(() {
            _showPagination = true;
          });
        }
      } else {
        if (_showPagination) {
          setState(() {
            _showPagination = false;
          });
        }
      }
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _pageController.dispose();
    _pageFocusNode.dispose();
    _pageController2.dispose();
    _pageFocusNode2.dispose();
    super.dispose();
  }

  int get _totalSymptoms {
    int total = 0;
    for (var report in _reports) {
      final symptomsValue = report['symptoms'];
      if (symptomsValue is String && symptomsValue.isNotEmpty) {
        total += symptomsValue.split(',').length;
      } else if (symptomsValue is List) {
        total += symptomsValue.length;
      }
    }
    return total;
  }

  String _formatDate(DateTime dateTime) {
    final now = DateTime.now();
    final difference = now.difference(dateTime);

    if (difference.inMinutes < 1) {
      return 'Just now';
    } else if (difference.inMinutes < 60) {
      return '${difference.inMinutes} min ago';
    } else if (difference.inHours < 24) {
      return '${difference.inHours} hr ago';
    } else if (difference.inDays == 1) {
      return 'Yesterday';
    } else if (difference.inDays < 7) {
      return '${difference.inDays} days ago';
    } else {
      return '${_monthName(dateTime.month)} ${dateTime.day}, ${dateTime.year}';
    }
  }

  String _monthName(int month) {
    const months = [
      '', // index 0 unused
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return months[month];
  }

  String _formatTime(DateTime dateTime) {
    final hour = dateTime.hour % 12 == 0 ? 12 : dateTime.hour % 12;
    final period = dateTime.hour >= 12 ? 'PM' : 'AM';
    return '$hour:${dateTime.minute.toString().padLeft(2, '0')} $period';
  }

  String _normalizeDistrictLabel(String? value) {
    final raw = (value ?? '').trim();
    if (raw.isEmpty) return 'Unknown';
    final cleaned = raw
        .replaceAll(RegExp(r'[_-]+'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
    final match = RegExp(
      r'^district\s*(\d+)$',
      caseSensitive: false,
    ).firstMatch(cleaned);
    if (match != null) return 'District ${match.group(1)}';
    return cleaned
        .split(' ')
        .map(
          (part) => part.isEmpty
              ? part
              : '${part[0].toUpperCase()}${part.substring(1).toLowerCase()}',
        )
        .join(' ');
  }

  Future<void> _fetchReports() async {
    if (Session.currentUser == null) {
      setState(() => _isLoading = false);
      return;
    }

    final userId = (Session.currentUser!['_id'] ?? Session.currentUser!['id'])
        ?.toString();
    if (userId == null) {
      setState(() => _isLoading = false);
      return;
    }

    final data = await ApiService.getUserReports(
      userId,
      page: _currentPage + 1,
      limit: _itemsPerPage,
    );
    final rawItems = data['items'];
    final reports = rawItems is List
        ? rawItems
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList()
        : <Map<String, dynamic>>[];
    final pagination = data['pagination'];

    setState(() {
      _reports = reports;
      _totalReportCount = pagination is Map
          ? (pagination['total'] as num?)?.toInt() ?? reports.length
          : reports.length;
      _serverTotalPages = pagination is Map
          ? (pagination['totalPages'] as num?)?.toInt() ?? 1
          : 1;
      _isLoading = false;
    });
  }

  Future<void> _goToPage(int pageIndex) async {
    if (pageIndex < 0 ||
        pageIndex >= _totalPages ||
        pageIndex == _currentPage) {
      return;
    }
    setState(() {
      _currentPage = pageIndex;
      _isLoading = true;
      _showFirstPageInput = false;
      _showSecondPageInput = false;
    });
    await _fetchReports();
    if (_scrollController.hasClients) _scrollController.jumpTo(0);
  }

  List<Map<String, dynamic>> get _paginatedReports {
    return _reports;
  }

  int get _totalPages {
    return _serverTotalPages;
  }

  List<dynamic> _buildPageModel() {
    final int total = _totalPages;
    final int current = _currentPage + 1;

    if (total <= 5) {
      return List.generate(total, (i) => i + 1);
    }

    // 🔹 CASE 1: Near start
    if (current <= 3) {
      return [1, 2, 3, '...', total];
    }

    // 🔹 CASE 2: Near end
    if (current >= total - 2) {
      return [1, '...', total - 2, total - 1, total];
    }

    // 🔹 CASE 3: Middle
    return [1, '...', current, '...', total];
  }

  int get _totalDistrictsReported {
    return _reports.where((report) {
      var value = report['food_location'];
      return value != null && value != "Not sure";
    }).length;
  }

  String _formatNumber(int number) {
    if (number >= 1000000000) {
      return '${(number / 1000000000).toStringAsFixed(1)}b';
    } else if (number >= 1000000) {
      return '${(number / 1000000).toStringAsFixed(1)}m';
    } else if (number >= 100000) {
      return '${(number / 1000).toStringAsFixed(1)}k';
    } else if (number >= 10000) {
      return '${(number / 1000).toStringAsFixed(1)}k';
    } else if (number >= 1000) {
      return number.toString().replaceAllMapped(
        RegExp(r'\B(?=(\d{3})+(?!\d))'),
        (match) => ',',
      );
    } else {
      return number.toString();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        shape: Border(
          bottom: BorderSide(
            color: Colors.grey.shade300, // light gray border
            width: 1,
          ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Color(0xFF1F2937)),
          onPressed: () => Navigator.pop(context),
        ),
        surfaceTintColor: const Color(0xFFF9FAFB),
        backgroundColor: Colors.white,
        toolbarHeight: 92,
        titleSpacing: 16,
        title: Column(
          children: [
            Text(
              'Report History',
              style: GoogleFonts.inter(
                fontSize: 20,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Stats Row (FIXED)
              Row(
                children: [
                  Expanded(
                    child: _buildStatCard(
                      icon: LucideIcons.fileText,
                      iconBg: const Color(0xFFDBEAFE),
                      iconColor: const Color(0xFF2563EB),
                      value: _formatNumber(_totalReportCount),
                      label: 'Total Reports',
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildStatCard(
                      icon: LucideIcons.stethoscope,
                      iconBg: const Color(0xFFF3E8FF),
                      iconColor: const Color(0xFF9333EA),
                      value: _formatNumber(_totalSymptoms),
                      label: 'Page Symptoms',
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildStatCard(
                      icon: LucideIcons.mapPin,
                      iconBg: const Color(0xFFD1FAE5),
                      iconColor: const Color(0xFF059669),
                      value: _formatNumber(_totalDistrictsReported),
                      label: 'Page Areas',
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 20),

              // SCROLLABLE AREA
              Expanded(
                child: _isLoading
                    ? const AppLoadingCenter(message: 'Loading reports…')
                    : _reports.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              LucideIcons.fileText,
                              size: 64,
                              color: Colors.grey.shade300,
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'No reports found',
                              style: GoogleFonts.inter(
                                fontSize: 18,
                                color: Colors.grey.shade500,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Your submitted reports will appear here',
                              style: GoogleFonts.inter(
                                fontSize: 14,
                                color: Colors.grey.shade400,
                              ),
                            ),
                          ],
                        ),
                      )
                    : Column(
                        children: [
                          Expanded(
                            child: ListView.builder(
                              controller: _scrollController,
                              itemCount: _paginatedReports.length + 1,
                              itemBuilder: (context, index) {
                                if (index == _paginatedReports.length) {
                                  return _buildPaginationControls();
                                }

                                final report = _paginatedReports[index];

                                final reportedAtValue = report['reported_at'];
                                final reportedAtUtc = reportedAtValue is String
                                    ? DateTime.tryParse(reportedAtValue)
                                    : reportedAtValue is DateTime
                                    ? reportedAtValue
                                    : null;
                                final reportedAt = reportedAtUtc?.toLocal();

                                final symptomsValue = report['symptoms'];
                                final symptomsList = <String>[];
                                if (symptomsValue is String) {
                                  symptomsList.addAll(
                                    FormatHelpers.formatSymptoms(
                                      symptomsValue
                                          .split(',')
                                          .map((s) => s.trim())
                                          .where((s) => s.isNotEmpty),
                                    ),
                                  );
                                } else if (symptomsValue is List) {
                                  symptomsList.addAll(
                                    FormatHelpers.formatSymptoms(
                                      symptomsValue
                                          .map(
                                            (item) => item?.toString().trim(),
                                          )
                                          .where(
                                            (s) => s != null && s.isNotEmpty,
                                          )
                                          .cast<String>(),
                                    ),
                                  );
                                }

                                final location =
                                    report['location'] as Map<String, dynamic>?;
                                final rawReportLocation =
                                    (report['report_location'] as String?) ??
                                    (location?['district'] as String?) ??
                                    (location?['name'] as String?) ??
                                    'Unknown';
                                final reportLocationBase =
                                    _normalizeDistrictLabel(
                                      rawReportLocation.split(',').first.trim(),
                                    );

                                final reportBarangayNo =
                                    (location?['barangayNo'] as num?)?.toInt();
                                final reportBarangay =
                                    location?['barangay'] as String?;
                                final reportLocationDisplay =
                                    FormatHelpers.formatLocationDisplay(
                                      district: reportLocationBase,
                                      barangayNo: reportBarangayNo,
                                      barangayName: reportBarangay,
                                    );

                                final rawExposureSite =
                                    (report['food_location'] as String?) ??
                                    (report['exposureDistrict'] as String?) ??
                                    (location?['name'] as String?) ??
                                    'Unknown';
                                final exposureSiteBase =
                                    _normalizeDistrictLabel(
                                      rawExposureSite.split(',').first.trim(),
                                    );

                                final exposureBarangayNo =
                                    (report['exposureBarangayNo'] as num?)
                                        ?.toInt();
                                final exposureBarangay =
                                    report['exposureBarangay'] as String? ??
                                    location?['barangay'] as String?;
                                final exposureLocationDisplay =
                                    FormatHelpers.formatLocationDisplay(
                                      district: exposureSiteBase,
                                      barangayNo: exposureBarangayNo,
                                      barangayName: exposureBarangay,
                                    );

                                final foodSource =
                                    (report['food_source'] as String?) ??
                                    (report['foodSource'] as String?) ??
                                    'Unknown';

                                return Padding(
                                  padding: const EdgeInsets.only(bottom: 16),
                                  child: ReportCard(
                                    status: 'Reviewed',
                                    date: reportedAt != null
                                        ? _formatDate(reportedAt)
                                        : 'Unknown',
                                    time: reportedAt != null
                                        ? _formatTime(reportedAt)
                                        : 'Unknown',
                                    symptoms: symptomsList,
                                    reportLocation: reportLocationDisplay,
                                    reportBarangay: reportBarangay,
                                    exposureSite: exposureLocationDisplay,
                                    exposureBarangay: exposureBarangay,
                                    foodSource: foodSource,
                                  ),
                                );
                              },
                            ),
                          ),
                        ],
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatCard({
    required IconData icon,
    required Color iconBg,
    required Color iconColor,
    required String value,
    required String label,
  }) {
    return Container(
      height: 140,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            margin: const EdgeInsets.only(bottom: 6),
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, size: 20, color: iconColor),
          ),
          Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: Color(0xFF111827),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: GoogleFonts.inter(fontSize: 12, color: Color(0xFF6B7280)),
          ),
        ],
      ),
    );
  }

  Widget _buildDotWidget(int dotIndex, int dotCount, bool isMiddleRange) {
    if (dotCount == 2 && isMiddleRange) {
      final isShown = dotIndex == 1
          ? _showFirstPageInput
          : _showSecondPageInput;
      final controller = dotIndex == 1 ? _pageController : _pageController2;
      final focusNode = dotIndex == 1 ? _pageFocusNode : _pageFocusNode2;
      if (isShown) {
        return Container(
          width: 36,
          height: 32,
          margin: const EdgeInsets.all(4),
          child: TextField(
            controller: controller,
            focusNode: focusNode,
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            textAlignVertical: TextAlignVertical.center,
            style: GoogleFonts.inter(fontSize: 14),
            decoration: InputDecoration(
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 8,
                vertical: 4,
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(4),
                borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(4),
                borderSide: const BorderSide(color: Color(0xFF2563EB)),
              ),
            ),
            onSubmitted: (value) {
              final page = int.tryParse(value);
              setState(() {
                if (dotIndex == 1) {
                  _showFirstPageInput = false;
                } else {
                  _showSecondPageInput = false;
                }
              });
              if (page != null && page >= 1 && page <= _totalPages) {
                _goToPage(page - 1);
              }
              controller.clear();
            },
          ),
        );
      } else {
        return InkWell(
          onTap: () {
            setState(() {
              if (dotIndex == 1) {
                _showFirstPageInput = true;
                _showSecondPageInput = false;
                _pageController.clear();
              } else {
                _showSecondPageInput = true;
                _showFirstPageInput = false;
                _pageController2.clear();
              }
            });
            WidgetsBinding.instance.addPostFrameCallback((_) {
              focusNode.requestFocus();
            });
          },
          borderRadius: BorderRadius.circular(20),
          child: SizedBox(
            height: 32,
            width: 32,
            child: Center(
              child: Text(
                '...',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  color: const Color(0xFF4B5563),
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
        );
      }
    } else {
      if (_showFirstPageInput) {
        return Container(
          width: 36,
          height: 32,
          margin: const EdgeInsets.all(4),
          child: TextField(
            controller: _pageController,
            focusNode: _pageFocusNode,
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            textAlignVertical: TextAlignVertical.center,
            style: GoogleFonts.inter(fontSize: 14),
            decoration: InputDecoration(
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 8,
                vertical: 4,
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(4),
                borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(4),
                borderSide: const BorderSide(color: Color(0xFF2563EB)),
              ),
            ),
            onSubmitted: (value) {
              final page = int.tryParse(value);
              if (page != null && page >= 1 && page <= _totalPages) {
                _goToPage(page - 1);
              }
              setState(() {
                _showFirstPageInput = false;
              });
              _pageController.clear();
            },
          ),
        );
      } else {
        return InkWell(
          onTap: () {
            setState(() {
              _showFirstPageInput = true;
              _pageController.clear();
            });
            WidgetsBinding.instance.addPostFrameCallback((_) {
              _pageFocusNode.requestFocus();
            });
          },
          borderRadius: BorderRadius.circular(20),
          child: SizedBox(
            height: 32,
            width: 32,
            child: Center(
              child: Text(
                '...',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  color: const Color(0xFF4B5563),
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
        );
      }
    }
  }

  Widget _buildPaginationControls() {
    final pages = _buildPageModel();
    final int dotCount = pages.where((p) => p == '...').length;
    final bool isMiddleRange =
        _totalPages > 5 &&
        _currentPage + 1 > 3 &&
        _currentPage + 1 < _totalPages - 2;

    if (_totalPages <= 1) return const SizedBox.shrink();

    Widget buildCircularButton({
      required String text,
      required VoidCallback? onPressed,
      required bool isActive,
      required bool isDisabled,
    }) {
      if (isActive) {
        // Active page: circular blue button
        return Container(
          width: 32,
          height: 32,
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            color: Color(0xFF2563EB),
          ),
          child: InkWell(
            onTap: onPressed,
            borderRadius: BorderRadius.circular(20),
            child: Center(
              child: Text(
                text,
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: Colors.white,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
        );
      } else {
        // Inactive page: regular text button
        return InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(20),
          child: SizedBox(
            height: 32,
            width: 32,
            child: Center(
              child: Text(
                text,
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: const Color(0xFF4B5563),
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
        );
      }
    }

    int dotIndex = 0;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Back button
          TextButton(
            onPressed: _currentPage > 0
                ? () {
                    _goToPage(_currentPage - 1);
                  }
                : null,
            child: Text(
              '< Back',
              style: GoogleFonts.inter(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: _currentPage > 0 ? const Color(0xFF2563EB) : Colors.grey,
              ),
            ),
          ),

          if (_totalPages > 1) ...[
            Row(
              children: [
                for (final p in pages) ...[
                  if (p == '...')
                    _buildDotWidget(++dotIndex, dotCount, isMiddleRange)
                  else
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 2),
                      child: buildCircularButton(
                        text: '$p',
                        isActive: p == _currentPage + 1,
                        isDisabled: false,
                        onPressed: () {
                          _goToPage(p - 1);
                        },
                      ),
                    ),
                ],
              ],
            ),
          ],

          // Next button
          TextButton(
            onPressed: _currentPage < _totalPages - 1
                ? () {
                    _goToPage(_currentPage + 1);
                  }
                : null,
            child: Text(
              'Next >',
              style: GoogleFonts.inter(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: _currentPage < _totalPages - 1
                    ? const Color(0xFF2563EB)
                    : Colors.grey,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class ReportCard extends StatelessWidget {
  final String status;
  final String date;
  final String time;
  final List<String> symptoms;
  final String reportLocation;
  final String? reportBarangay;
  final String exposureSite;
  final String? exposureBarangay;
  final String foodSource;
  final VoidCallback? onDetailsTap;

  const ReportCard({
    super.key,
    required this.status,
    required this.date,
    required this.time,
    required this.symptoms,
    required this.reportLocation,
    this.reportBarangay,
    required this.exposureSite,
    this.exposureBarangay,
    required this.foodSource,
    this.onDetailsTap,
  });

  Color get statusColor {
    switch (status.toLowerCase()) {
      case 'reviewed':
        return Colors.blue;
      case 'pending':
        return Colors.orange;
      case 'resolved':
        return Colors.green;
      case 'rejected':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Date and Time
                Container(
                  padding: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    border: Border(
                      bottom: BorderSide(color: Colors.grey.shade100),
                    ),
                  ),
                  child: Row(
                    children: [
                      Row(
                        children: [
                          Icon(
                            LucideIcons.calendar,
                            size: 14,
                            color: Colors.grey.shade600,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            date,
                            style: GoogleFonts.inter(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: Colors.grey.shade700,
                            ),
                          ),
                        ],
                      ),

                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        child: Text(
                          '•',
                          style: GoogleFonts.inter(color: Colors.grey.shade400),
                        ),
                      ),

                      Row(
                        children: [
                          Icon(
                            LucideIcons.clock,
                            size: 14,
                            color: Colors.grey.shade500,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            time,
                            style: GoogleFonts.inter(
                              fontSize: 14,
                              color: Colors.grey.shade600,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 16),

                // Symptoms
                Row(
                  children: [
                    Icon(
                      Icons.medical_services_outlined,
                      size: 16,
                      color: Colors.grey.shade400,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'Symptoms',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: Colors.grey.shade700,
                        letterSpacing: 1,
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 10),

                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: symptoms.map((symptom) {
                    return Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(
                          color: statusColor.withValues(alpha: 0.15),
                        ),
                      ),
                      child: Text(
                        symptom,
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: statusColor,
                        ),
                      ),
                    );
                  }).toList(),
                ),

                const SizedBox(height: 16),

                // Food Source Card
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.grey.shade100),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        LucideIcons.utensilsCrossed,
                        size: 18,
                        color: Colors.teal.shade600,
                      ),
                      const SizedBox(width: 8),

                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Food Source',
                              style: GoogleFonts.inter(
                                fontSize: 12,
                                color: Colors.grey.shade500,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              foodSource,
                              style: GoogleFonts.inter(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: Colors.teal.shade700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                SizedBox(height: 16),

                // Location Card
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.grey.shade100),
                  ),
                  child: Column(
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            LucideIcons.mapPin,
                            size: 18,
                            color: Colors.blue.shade600,
                          ),
                          const SizedBox(width: 8),

                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Report Location',
                                  style: GoogleFonts.inter(
                                    fontSize: 12,
                                    color: Colors.grey.shade500,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  reportLocation,
                                  style: GoogleFonts.inter(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.grey.shade900,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),

                      Container(
                        margin: const EdgeInsets.only(top: 12),
                        padding: const EdgeInsets.only(top: 12),
                        decoration: BoxDecoration(
                          border: Border(
                            top: BorderSide(color: Colors.grey.shade200),
                          ),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              LucideIcons.map,
                              size: 18,
                              color: Colors.orange.shade600,
                            ),
                            const SizedBox(width: 8),

                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Exposure Site',
                                    style: GoogleFonts.inter(
                                      fontSize: 12,
                                      color: Colors.grey.shade500,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    exposureSite,
                                    style: GoogleFonts.inter(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                      color: Colors.orange.shade700,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
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
