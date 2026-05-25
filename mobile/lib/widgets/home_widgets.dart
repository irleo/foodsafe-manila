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

  @override
  void initState() {
    super.initState();
    _loadHeader();
    locationText = LocationService.cachedAddress ?? "Fetching...";

    // Optionally, refresh in background
    LocationService.getUserAddress(forceRefresh: true).then((updated) {
      if (mounted) {
        setState(() {
          locationText = updated;
        });
      }
    });
  }

  Future<void> _loadHeader() async {
    _updateDate();

    LocationService.getUserAddress().then((address) {
      setState(() {
        locationText = address;
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
  final bool isLoading;
  final String? error;

  const DashboardSummaryCard({
    super.key,
    this.data,
    this.isLoading = false,
    this.error,
  });

  String _getCurrentYear() {
    return DateTime.now().year.toString();
  }

  String _getDateRange() {
    final now = DateTime.now();
    final startOfYear = DateTime(now.year, 1, 1);
    final formatter = DateFormat('MMM d');
    return "${formatter.format(startOfYear)}–${formatter.format(now)}, ${now.year}";
  }

  @override
  Widget build(BuildContext context) {
    final currentYear = _getCurrentYear();
    final dateRange = _getDateRange();

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
          /// HEADER ROW
          Row(
            children: [
              Expanded(
                child: Text(
                  "Dashboard Summary",
                  style: GoogleFonts.inter(
                      fontSize: 16, fontWeight: FontWeight.w700),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFFDBEAFE),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  currentYear,
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF1E40AF),
                  ),
                ),
              ),
            ],
          ),
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
                    label: "Total Cases",
                    value: totalCases,
                    sub: dateRange,
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
                    label: "Top District",
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
  final String? sub;
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
    this.sub,
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
              if(sub != null)
              Text(
                sub!,
                style: GoogleFonts.inter(fontSize: 8, color: valueColor.withValues(alpha: 0.85)),
              )
              else
                SizedBox.shrink()
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

/* ---------------- Map CTA ---------------- */

class YourAreaRiskCard extends StatelessWidget {
  final Map<String, dynamic>? data;
  final bool isLoading;
  final String? error;

  const YourAreaRiskCard({
    super.key,
    this.data,
    this.isLoading = false,
    this.error,
  });

  @override
  Widget build(BuildContext context) {
    if (isLoading) return const _Card(child: AppLoadingCard());

    if (error != null) {
      return _Card(
        child: Row(
          children: [
            const Icon(LucideIcons.mapPin, color: Color(0xFF6B7280), size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                error!,
                style: GoogleFonts.inter(
                  fontSize: 13,
                  color: const Color(0xFF6B7280),
                ),
              ),
            ),
          ],
        ),
      );
    }

    final area = data?['area'] as Map<String, dynamic>?;
    final isHigh = data?['isHighRisk'] == true;
    final level = area?['riskLevel']?.toString() ?? 'low';
    final score = area?['riskScore'] ?? 0;
    final total = area?['totalCases'] ?? 0;
    final location = LocationService.cachedAddress ?? 'Your location';

    late final Color accent;
    late final Color bg;
    late final String label;

    if (isHigh || level == 'high') {
      accent = const Color(0xFFDC2626);
      bg = const Color(0xFFFEE2E2);
      label = 'High Risk Area';
    } else if (level == 'moderate') {
      accent = const Color(0xFFD97706);
      bg = const Color(0xFFFEF3C7);
      label = 'Moderate Risk Area';
    } else {
      accent = const Color(0xFF16A34A);
      bg = const Color(0xFFDCFCE7);
      label = 'Low Risk Area';
    }

    return _Card(
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
            child: Icon(
              isHigh ? LucideIcons.triangleAlert : LucideIcons.shield,
              color: accent,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Your Area',
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: const Color(0xFF9CA3AF),
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  label,
                  style: GoogleFonts.inter(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: accent,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  location,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    color: const Color(0xFF6B7280),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '$total cases · Risk score $score',
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

  @override
  Widget build(BuildContext context) {
    final high = (riskStats['High'] ?? 0) + (riskStats['Critical'] ?? 0);
    final moderate = riskStats['Medium'] ?? 0;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF14B8A6), Color(0xFF0D9488)],
          ),
          borderRadius: BorderRadius.circular(18),
          boxShadow: const [
            BoxShadow(
              blurRadius: 18,
              offset: Offset(0, 8),
              color: Color(0x22000000),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _IconBubble(icon: LucideIcons.navigation),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "Interactive Disease Map",
                        style: GoogleFonts.inter(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                      SizedBox(height: 4),
                      Text(
                        "Explore outbreak zones with filters & live data",
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          color: Color(0xFFCCFBF1),
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(LucideIcons.mapPin, color: Colors.white),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _DotLabel(
                  color: const Color(0xFFF87171),
                  text: isLoading
                      ? 'Loading zones…'
                      : '$high High Risk Zones',
                ),
                const SizedBox(width: 14),
                _DotLabel(
                  color: const Color(0xFFFACC15),
                  text: isLoading ? '' : '$moderate Moderate',
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _IconBubble extends StatelessWidget {
  final IconData icon;
  const _IconBubble({required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Icon(icon, color: Colors.white),
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
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 8),
        Text(
          text,
          style: GoogleFonts.inter(
            color: Colors.white,
            fontSize: 12,
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

    final low = '${riskStats['Low'] ?? 0}';
    final medium = '${riskStats['Medium'] ?? 0}';
    final high = '${riskStats['High'] ?? 0}';
    final critical = '${riskStats['Critical'] ?? 0}';

    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Current Risk Status',
            style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          Text(
            'District-level risk from validated case data',
            style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF9CA3AF)),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _RiskMini(
                  icon: LucideIcons.shield,
                  bg: const Color(0xFFDCFCE7),
                  fg: const Color(0xFF16A34A),
                  value: low,
                  label: 'Low',
                ),
              ),
              Expanded(
                child: _RiskMini(
                  icon: LucideIcons.activity,
                  bg: const Color(0xFFFEF9C3),
                  fg: const Color(0xFFCA8A04),
                  value: medium,
                  label: 'Medium',
                ),
              ),
              Expanded(
                child: _RiskMini(
                  icon: LucideIcons.trendingUp,
                  bg: const Color(0xFFFFEDD5),
                  fg: const Color(0xFFF97316),
                  value: high,
                  label: 'High',
                ),
              ),
              Expanded(
                child: _RiskMini(
                  icon: LucideIcons.triangleAlert,
                  bg: const Color(0xFFFEE2E2),
                  fg: const Color(0xFFDC2626),
                  value: critical,
                  label: 'Critical',
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
  final bool isLoading;
  final String? error;

  const TopDistrictsSection({
    super.key,
    this.districts = const [],
    this.isLoading = false,
    this.error,
  });

  @override
  Widget build(BuildContext context) {
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Top Affected Districts',
            style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          if (isLoading)
            const AppLoadingCard(padding: EdgeInsets.all(16))
          else if (error != null)
            Text(
              error!,
              style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF6B7280)),
            )
          else if (districts.isEmpty)
            Text(
              'No district data available.',
              style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF9CA3AF)),
            )
          else
            ...districts.asMap().entries.map((entry) {
              final idx = entry.key;
              final d = entry.value;
              final name = d['name']?.toString() ?? '';
              final cases = d['cases']?.toString() ?? '0';
              return Padding(
                padding: EdgeInsets.only(bottom: idx < districts.length - 1 ? 8 : 0),
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
                'Nearby Alerts',
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
                    'No active risk alerts in your area.',
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
                        _RiskPillCompact(level: item.risk),
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
                        Text(
                          item.timeAgo,
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            color: const Color(0xFF9CA3AF),
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

  const _RiskPillCompact({required this.level});

  @override
  Widget build(BuildContext context) {
    late final Color bg;
    late final Color fg;
    late final String label;

    switch (level) {
      case RiskLevel.high:
        bg = const Color(0xFFFEE2E2);
        fg = const Color(0xFFB91C1C);
        label = 'High';
        break;
      case RiskLevel.moderate:
        bg = const Color(0xFFFEF3C7);
        fg = const Color(0xFFB45309);
        label = 'Moderate';
        break;
      case RiskLevel.low:
        bg = const Color(0xFFDCFCE7);
        fg = const Color(0xFF15803D);
        label = 'Low';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: GoogleFonts.inter(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: fg,
        ),
      ),
    );
  }
}

class _NearbyRiskColors {
  final Color bg;
  final Color icon;

  const _NearbyRiskColors({required this.bg, required this.icon});
}

_NearbyRiskColors _riskColorsFor(RiskLevel level) {
  switch (level) {
    case RiskLevel.high:
      return const _NearbyRiskColors(
        bg: Color(0xFFFEE2E2),
        icon: Color(0xFFDC2626),
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