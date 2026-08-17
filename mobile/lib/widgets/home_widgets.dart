import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../services/location_service.dart';
import '../widgets/alerts_widgets.dart';
import 'app_loading.dart';

class Header extends StatefulWidget {
  final VoidCallback onTap;
  const Header({super.key, required this.onTap});

  @override
  State<Header> createState() => _HeaderState();
}

class _HeaderState extends State<Header> {
  late String locationText;
  String dateText = "";

  String _normalizeDistrictLabel(String value) {
    final cleaned = value
        .trim()
        .replaceAll(RegExp(r'[_-]+'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ');
    final match = RegExp(r'^district\s*(\d+)$', caseSensitive: false)
        .firstMatch(cleaned);
    if (match != null) return 'District ${match.group(1)}';
    return cleaned;
  }

  String _composeHeaderLocation(String fallback) {
    final manila = LocationService.cachedManilaLocation;
    if (manila != null) {
      final district = _normalizeDistrictLabel(manila.district);
      final barangayNo = manila.barangayNo;
      if (barangayNo > 0) return '$district, Barangay $barangayNo';
      final barangay = manila.barangay.trim();
      if (barangay.isNotEmpty) return '$district, $barangay';
      return district;
    }
    return fallback;
  }

  @override
  void initState() {
    super.initState();
    _loadHeader();
    locationText = _composeHeaderLocation(
      LocationService.cachedAddress ?? "Fetching...",
    );

    // Optionally, refresh in background
    LocationService.getUserAddress(forceRefresh: true).then((updated) {
      if (mounted) {
        setState(() {
          locationText = _composeHeaderLocation(updated);
        });
      }
    });
  }

  Future<void> _loadHeader() async {
    _updateDate();

    LocationService.getUserAddress().then((address) {
      setState(() {
        locationText = _composeHeaderLocation(address);
      });
    });
  }

  void _updateDate() {
    final now = DateTime.now();
    dateText = DateFormat('EEEE, MMM dd, hh:mm a').format(now);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 30, 16, 36),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF2563EB), Color(0xFF1D4ED8)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(20)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [

          /// TOP BAR
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Image.asset(
                'assets/foodsafe_logo.png',
                scale: 7,
              ),

              InkWell(
                onTap: widget.onTap,
                borderRadius: BorderRadius.circular(999),
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: .15),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: const Color(0xFFF3F4F6).withValues(alpha: .15),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Icon(
                          LucideIcons.user,
                          color: Colors.white,
                        ),
                      ),
                      Positioned(
                        top: 7,
                        right: 7,
                        child: Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: Color(0xFFEF4444),
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),

          /// LOCATION CARD
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: .15),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [

                Row(
                  children: [
                    Icon(LucideIcons.mapPin,
                        size: 16, color: Colors.white),
                    const SizedBox(width: 6),
                    Text(
                      locationText,
                      style: GoogleFonts.inter(
                        fontSize: 16,
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 4),

                Text(
                  dateText,
                  style:
                      GoogleFonts.inter(fontSize: 11, color: Colors.white),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class DashboardSummaryCard extends StatelessWidget {
  final Map<String, dynamic>? data;
  final String? referencePeriod;
  final bool isLoading;
  final String? error;

  const DashboardSummaryCard({
    super.key,
    this.data,
    this.referencePeriod,
    this.isLoading = false,
    this.error,
  });

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return const _Card(child: AppLoadingCard());
    }

    if (error != null) {
      return _Card(
        child: Text(
          error!,
          style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF6B7280)),
        ),
      );
    }

    final totalCases = data?['totalCases']?.toString() ?? '0';
    final topDisease = data?['topDisease']?.toString() ?? 'N/A';
    final topDistrict = data?['topDistrict']?.toString() ?? 'N/A';
    final growthRaw = data?['growth'];
    final growthValue = double.tryParse(growthRaw?.toString() ?? '') ?? 0;
    final growthText =
        '${growthValue >= 0 ? '+' : ''}${growthValue.toStringAsFixed(1)}%';
    final growthColor = growthValue >= 0
        ? const Color(0xFF059669)
        : const Color(0xFFDC2626);
    final growthIcon =
        growthValue >= 0 ? Icons.trending_up : Icons.trending_down;

    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Dashboard Summary',
            style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w800),
          ),
          if (referencePeriod != null && referencePeriod!.isNotEmpty) ...[
            const SizedBox(height: 4),
            _SectionReferenceDate(label: referencePeriod!),
          ],
          const SizedBox(height: 12),

          /// STAT TILES ROW 1
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: _StatTile(
                    bg: const Color(0xFFFFF1F2),
                    border: const Color(0xFFFECACA),
                    icon: LucideIcons.activity,
                    iconColor: const Color(0xFFDC2626),
                    label: "Validated / Confirmed Cases",
                    value: totalCases,
                    valueColor: const Color(0xFFB91C1C),
                    growthText: growthText,
                    growthColor: growthColor,
                    growthIcon: growthIcon,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 10),

          /// STAT TILES ROW 2
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: _StatTile(
                    bg: const Color(0xFFFAF5FF),
                    border: const Color(0xFFE9D5FF),
                    icon: LucideIcons.stethoscope,
                    iconColor: const Color(0xFF7C3AED),
                    label: "Top Disease",
                    value: topDisease,
                    valueColor: const Color(0xFF6D28D9),
                    isSmallValue: true,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _StatTile(
                    bg: const Color(0xFFEFF6FF),
                    border: const Color(0xFFBFDBFE),
                    icon: LucideIcons.mapPin,
                    iconColor: const Color(0xFF2563EB),
                    label: "Highest Case Concentration",
                    value: topDistrict,
                    valueColor: const Color(0xFF1D4ED8),
                    isSmallValue: true,
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

class _StatTile extends StatelessWidget {
  final Color bg;
  final Color border;
  final IconData icon;
  final Color iconColor;
  final String label;
  final String value;
  final Color valueColor;
  final bool isSmallValue;
  final String? growthText;
  final Color? growthColor;
  final IconData? growthIcon;

  const _StatTile({
    required this.bg,
    required this.border,
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.value,
    required this.valueColor,
    this.isSmallValue = false,
    this.growthText,
    this.growthColor,
    this.growthIcon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 100,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: border),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(icon, size: 16, color: iconColor),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                value,
                style: GoogleFonts.inter(
                  fontSize: isSmallValue ? 13 : 16,
                  fontWeight: FontWeight.w800,
                  color: valueColor,
                  height: 1.3
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 2),
              Text(
                label,
                style: GoogleFonts.inter(
                  fontSize: 9,
                  fontWeight: FontWeight.w500,
                  color: valueColor,
                ),
              ),
            ],
          ),
          if (growthText != null && growthColor != null)
            Align(
              alignment: Alignment.topRight,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                decoration: BoxDecoration(
                  color: Color.lerp(growthColor!, Colors.white, 0.85),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(growthIcon ?? Icons.trending_up,
                        size: 14, color: growthColor),
                    const SizedBox(width: 4),
                    Text(
                      growthText!,
                      style: GoogleFonts.inter(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: growthColor,
                      ),
                    ),
                  ],
                ),
              ),
            )
        ],
      )
    );
  }
}

class TopDiseaseSection extends StatelessWidget {
  final List<Map<String, dynamic>> diseases;
  final String? referencePeriod;
  final bool isLoading;
  final String? error;

  const TopDiseaseSection({
    super.key,
    this.diseases = const [],
    this.referencePeriod,
    this.isLoading = false,
    this.error,
  });

  @override
  Widget build(BuildContext context) {
    return _RankedMetricsSection(
      title: 'Top Reported Diseases',
      emptyMessage: 'No disease data available.',
      items: diseases,
      referencePeriod: referencePeriod,
      isLoading: isLoading,
      error: error,
    );
  }
}

class _SectionReferenceDate extends StatelessWidget {
  final String label;

  const _SectionReferenceDate({required this.label});

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: GoogleFonts.inter(
        fontSize: 11,
        color: const Color(0xFF9CA3AF),
      ),
    );
  }
}

class MapCtaCard extends StatelessWidget {
  final Map<String, int> riskStats;
  final bool isLoading;
  final VoidCallback? onTap;

  const MapCtaCard({
    super.key,
    this.riskStats = const {},
    this.isLoading = false,
    this.onTap,
  });

  static const _riskLegend = [
    (key: 'Cases', label: 'cases', color: Color(0xFF1E3A8A)),
    (key: 'Districts', label: 'districts', color: Color(0xFF2563EB)),
    (key: 'Barangays', label: 'barangays', color: Color(0xFF60A5FA)),
    (key: 'Average', label: 'avg/district', color: Color(0xFFBFDBFE)),
  ];

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: _Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      LucideIcons.map,
                      color: Color(0xFF2563EB),
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Case Concentration Map',
                          style: GoogleFonts.inter(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFF111827),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'View confirmed case distribution',
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            color: const Color(0xFF6B7280),
                            height: 1.35,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(
                    LucideIcons.chevronRight,
                    size: 20,
                    color: Color(0xFF9CA3AF),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Wrap(
                spacing: 12,
                runSpacing: 8,
                children: _riskLegend.map((entry) {
                  final count = isLoading ? '—' : '${riskStats[entry.key] ?? 0}';
                  return _DotLabel(
                    color: entry.color,
                    text: '$count ${entry.label}',
                  );
                }).toList(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DotLabel extends StatelessWidget {
  final Color color;
  final String text;
  const _DotLabel({required this.color, required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(
          text,
          style: GoogleFonts.inter(
            color: const Color(0xFF374151),
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

/* ---------------- Current Risk ---------------- */

class CurrentRiskCard extends StatelessWidget {
  final Map<String, int> riskStats;
  final bool isLoading;
  final String? error;

  const CurrentRiskCard({
    super.key,
    this.riskStats = const {},
    this.isLoading = false,
    this.error,
  });

  @override
  Widget build(BuildContext context) {
    if (isLoading) return const _Card(child: AppLoadingCard());

    if (error != null) {
      return _Card(
        child: Text(
          error!,
          style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF6B7280)),
        ),
      );
    }

    final cases = '${riskStats['Cases'] ?? 0}';
    final districts = '${riskStats['Districts'] ?? 0}';
    final barangays = '${riskStats['Barangays'] ?? 0}';
    final average = '${riskStats['Average'] ?? 0}';

    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Validated / Confirmed Case Concentration',
            style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _RiskMini(
                  icon: LucideIcons.shield,
                  bg: const Color(0xFFDCFCE7),
                  fg: const Color(0xFF16A34A),
                  value: cases,
                  label: 'Cases',
                ),
              ),
              Expanded(
                child: _RiskMini(
                  icon: LucideIcons.activity,
                  bg: const Color(0xFFFEF9C3),
                  fg: const Color(0xFFCA8A04),
                  value: districts,
                  label: 'Districts',
                ),
              ),
              Expanded(
                child: _RiskMini(
                  icon: LucideIcons.trendingUp,
                  bg: const Color(0xFFFFEDD5),
                  fg: const Color(0xFFF97316),
                  value: barangays,
                  label: 'Barangays',
                ),
              ),
              Expanded(
                child: _RiskMini(
                  icon: LucideIcons.triangleAlert,
                  bg: const Color(0xFFFEE2E2),
                  fg: const Color(0xFFDC2626),
                  value: average,
                  label: 'Avg/district',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class TopDistrictsSection extends StatelessWidget {
  final List<Map<String, dynamic>> districts;
  final String? referencePeriod;
  final bool isLoading;
  final String? error;

  const TopDistrictsSection({
    super.key,
    this.districts = const [],
    this.referencePeriod,
    this.isLoading = false,
    this.error,
  });

  @override
  Widget build(BuildContext context) {
    return _RankedMetricsSection(
      title: 'Top Affected Districts',
      emptyMessage: 'No district data available.',
      items: districts,
      referencePeriod: referencePeriod,
      isLoading: isLoading,
      error: error,
    );
  }
}

class _RankedMetricsSection extends StatelessWidget {
  final String title;
  final String emptyMessage;
  final List<Map<String, dynamic>> items;
  final String? referencePeriod;
  final bool isLoading;
  final String? error;

  const _RankedMetricsSection({
    required this.title,
    required this.emptyMessage,
    required this.items,
    this.referencePeriod,
    required this.isLoading,
    this.error,
  });

  @override
  Widget build(BuildContext context) {
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w800),
          ),
          if (referencePeriod != null && referencePeriod!.isNotEmpty) ...[
            const SizedBox(height: 4),
            _SectionReferenceDate(label: referencePeriod!),
          ],
          const SizedBox(height: 12),
          if (isLoading)
            const AppLoadingCard(padding: EdgeInsets.all(16))
          else if (error != null)
            Text(
              error!,
              style: GoogleFonts.inter(
                fontSize: 13,
                color: const Color(0xFF6B7280),
              ),
            )
          else if (items.isEmpty)
            Text(
              emptyMessage,
              style: GoogleFonts.inter(
                fontSize: 13,
                color: const Color(0xFF9CA3AF),
              ),
            )
          else
            ...items.asMap().entries.map((entry) {
              final idx = entry.key;
              final item = entry.value;
              final name = item['name']?.toString() ?? '';
              final cases = item['cases']?.toString() ?? '0';
              return Padding(
                padding: EdgeInsets.only(
                  bottom: idx < items.length - 1 ? 8 : 0,
                ),
                child: Row(
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '${idx + 1}',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF2563EB),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        name,
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    Text(
                      '$cases cases',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: const Color(0xFF6B7280),
                      ),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}

class _RiskMini extends StatelessWidget {
  final IconData icon;
  final Color bg;
  final Color fg;
  final String value;
  final String label;

  const _RiskMini({
    required this.icon,
    required this.bg,
    required this.fg,
    required this.value,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
          child: Icon(icon, color: fg),
        ),
        const SizedBox(height: 8),
        Text(
          value,
          style: GoogleFonts.inter(
            fontSize: 20,
            fontWeight: FontWeight.w900,
            color: fg,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: GoogleFonts.inter(fontSize: 11, color: Color(0xFF6B7280)),
        ),
      ],
    );
  }
}

/* ---------------- Nearby Alerts ---------------- */

class NearbyAlertsSection extends StatelessWidget {
  final List<AlertItem> alerts;
  final bool isLoading;
  final VoidCallback? onSeeAll;

  const NearbyAlertsSection({
    super.key,
    this.alerts = const [],
    this.isLoading = false,
    this.onSeeAll,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Health Advisories',
                style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w800),
              ),
            ),
            TextButton(
              onPressed: onSeeAll,
              child: Text(
                'See All',
                style: GoogleFonts.inter(
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFF2563EB),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (isLoading)
          const _Card(child: AppLoadingCard())
        else if (alerts.isEmpty)
          _Card(
            child: Row(
              children: [
                Icon(LucideIcons.bellOff, color: Colors.grey.shade400, size: 22),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'No published health advisories.',
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      color: const Color(0xFF6B7280),
                    ),
                  ),
                ),
              ],
            ),
          )
        else
          ...alerts.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _NearbyAlertCard(item: item),
            ),
          ),
      ],
    );
  }
}

class _NearbyAlertCard extends StatelessWidget {
  final AlertItem item;

  const _NearbyAlertCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final colors = _riskColorsFor(item.risk);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => showAlertDetailSheet(context, item),
        borderRadius: BorderRadius.circular(14),
        child: _Card(
          radius: 14,
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: colors.bg,
                  shape: BoxShape.circle,
                ),
                child: Icon(LucideIcons.triangleAlert, color: colors.icon),
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
                            item.title,
                            style: GoogleFonts.inter(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        _RiskPillCompact(level: item.risk, band: item.riskBand),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      item.message,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        color: const Color(0xFF6B7280),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Icon(
                          LucideIcons.mapPin,
                          size: 14,
                          color: Color(0xFF6B7280),
                        ),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            item.location,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.inter(
                              fontSize: 11,
                              color: const Color(0xFF6B7280),
                            ),
                          ),
                        ),
                      ],
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
}

class _RiskPillCompact extends StatelessWidget {
  final RiskLevel level;
  final String? band;

  const _RiskPillCompact({required this.level, this.band});

  @override
  Widget build(BuildContext context) {
    final style = _styleForLevel(level);
    final label = (band != null && band!.isNotEmpty) ? band! : style.label;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: style.bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: GoogleFonts.inter(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: style.fg,
        ),
      ),
    );
  }

  ({Color bg, Color fg, String label}) _styleForLevel(RiskLevel level) {
    switch (level) {
      case RiskLevel.critical:
        return (
          bg: const Color(0xFFFEE2E2),
          fg: const Color(0xFF991B1B),
          label: 'Critical',
        );
      case RiskLevel.high:
        return (
          bg: const Color(0xFFFFEDD5),
          fg: const Color(0xFFC2410C),
          label: 'High',
        );
      case RiskLevel.moderate:
        return (
          bg: const Color(0xFFFEF3C7),
          fg: const Color(0xFFB45309),
          label: 'Moderate',
        );
      case RiskLevel.low:
        return (
          bg: const Color(0xFFDCFCE7),
          fg: const Color(0xFF15803D),
          label: 'Low',
        );
    }
  }
}

class _NearbyRiskColors {
  final Color bg;
  final Color icon;

  const _NearbyRiskColors({required this.bg, required this.icon});
}

_NearbyRiskColors _riskColorsFor(RiskLevel level) {
  switch (level) {
    case RiskLevel.critical:
      return const _NearbyRiskColors(
        bg: Color(0xFFFEE2E2),
        icon: Color(0xFFDC2626),
      );
    case RiskLevel.high:
      return const _NearbyRiskColors(
        bg: Color(0xFFFFEDD5),
        icon: Color(0xFFEA580C),
      );
    case RiskLevel.moderate:
      return const _NearbyRiskColors(
        bg: Color(0xFFFEF3C7),
        icon: Color(0xFFD97706),
      );
    case RiskLevel.low:
      return const _NearbyRiskColors(
        bg: Color(0xFFDCFCE7),
        icon: Color(0xFF16A34A),
      );
  }
}

/* ---------------- Health Tips ---------------- */

class HealthTipsSection extends StatelessWidget {
  const HealthTipsSection({super.key});

  @override
  Widget build(BuildContext context) {
    final tips = const [
      _TipItem(
        title: "Food Safety",
        desc: "Always wash hands before eating and food preparation",
        icon: LucideIcons.shield,
      ),
      _TipItem(
        title: "Prevent Contamination",
        desc: "Cook food thoroughly and store at proper temperatures",
        icon: LucideIcons.info,
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          "Health Tips",
          style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 10),
        ...tips.map(
          (t) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _TipCard(item: t),
          ),
        ),
      ],
    );
  }
}

class _TipItem {
  final String title;
  final String desc;
  final IconData icon;
  const _TipItem({required this.title, required this.desc, required this.icon});
}

class _TipCard extends StatelessWidget {
  final _TipItem item;
  const _TipCard({required this.item});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFDBEAFE)),
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: const Color(0xFF2563EB),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(item.icon, color: Colors.white),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.title,
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  item.desc,
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    color: Color(0xFF6B7280),
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

/* ---------------- Shared Card ---------------- */

class _Card extends StatelessWidget {
  final Widget child;
  final double radius;
  final EdgeInsets padding;

  const _Card({
    required this.child,
    this.radius = 18,
    this.padding = const EdgeInsets.all(16),
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: const Color(0xFFF3F4F6)),
        boxShadow: const [
          BoxShadow(
            blurRadius: 14,
            offset: Offset(0, 6),
            color: Color(0x14000000),
          ),
        ],
      ),
      child: child,
    );
  }
}
