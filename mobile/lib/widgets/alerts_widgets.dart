import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

enum RiskLevel { critical, high, moderate, low }

class AlertItem {
  final String id;
  final String title;
  final RiskLevel risk;
  final String riskBand;
  final String message;
  final String location;
  final String district;
  final int? barangayNo;
  final String? barangayName;
  final String cases;
  final String distance;
  final double? avgIncidentRate;
  final DateTime? generatedAt;
  final String? dataCoverage;
  final Map<String, dynamic>? areaData;

  const AlertItem({
    required this.id,
    required this.title,
    required this.risk,
    required this.riskBand,
    required this.message,
    required this.location,
    required this.district,
    this.barangayNo,
    this.barangayName,
    required this.cases,
    required this.distance,
    this.avgIncidentRate,
    this.generatedAt,
    this.dataCoverage,
    this.areaData,
  });

  String get formattedTimestamp {
    final dt = generatedAt;
    if (dt == null) return 'Just now';
    return DateFormat('MMM d, yyyy · h:mm a').format(dt);
  }
}

class AlertCard extends StatelessWidget {
  final AlertItem item;
  final bool isUnread;
  final VoidCallback? onTap;

  const AlertCard({
    super.key,
    required this.item,
    this.isUnread = true,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = _riskColors(item.risk);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap ?? () => showAlertDetailSheet(context, item),
        borderRadius: BorderRadius.circular(14),
        child: Container(
      decoration: BoxDecoration(
        color: isUnread ? Colors.white : const Color(0xFFF9FAFB),
        borderRadius: BorderRadius.circular(14),
        border: isUnread
            ? Border(
                left: BorderSide(color: colors.secondary, width: 4),
                top: BorderSide(color: colors.secondary),
                right: BorderSide(color: colors.secondary),
                bottom: BorderSide(color: colors.secondary),
              )
            : Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: const [
          BoxShadow(
            blurRadius: 10,
            offset: Offset(0, 3),
            color: Color(0x14000000), // subtle shadow
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // icon bubble with unread badge
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: colors.secondary,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  item.risk == RiskLevel.low
                      ? LucideIcons.bell
                      : LucideIcons.triangleAlert,
                  color: colors.primary,
                  size: 26,
                ),
              ),
              if (isUnread)
                Positioned(
                  top: -2,
                  right: -2,
                  child: Container(
                    width: 14,
                    height: 14,
                    decoration: BoxDecoration(
                      color: const Color(0xFF2563EB),
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 2),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 12),

          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // title + badge
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        item.title,
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: item.risk == RiskLevel.critical ||
                                  item.risk == RiskLevel.high
                              ? const Color(0xFF111827)
                              : const Color(0xFF374151),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    _RiskPill(level: item.risk, band: item.riskBand),
                  ],
                ),
                const SizedBox(height: 8),

                Text(
                  item.message,
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    color: const Color(0xFF4B5563),
                  ),
                ),
                const SizedBox(height: 12),

                // location + time (2 cols)
                Row(
                  children: [
                    Expanded(
                      child: _MetaRow(
                        icon: LucideIcons.mapPin,
                        text: item.location,
                      ),
                    ),
                  ],
                ),
                if (item.generatedAt != null) ...[
                  const SizedBox(height: 6),
                  _MetaRow(
                    icon: LucideIcons.clock,
                    text: item.formattedTimestamp,
                  ),
                ],
                const SizedBox(height: 12),

                const Divider(height: 1, color: Color(0xFFF3F4F6)),
                const SizedBox(height: 12),

                Row(
                  children: [
                    Expanded(
                      child: Wrap(
                        spacing: 12,
                        children: [
                          Text(
                            item.cases,
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              color: const Color(0xFF6B7280),
                            ),
                          ),
                          Text(
                            item.distance,
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              color: const Color(0xFF6B7280),
                            ),
                          ),
                        ],
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

/// Full alert detail in a mobile-friendly bottom sheet.
void showAlertDetailSheet(BuildContext context, AlertItem item) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => AlertDetailSheet(item: item),
  );
}

class AlertDetailSheet extends StatelessWidget {
  final AlertItem item;

  const AlertDetailSheet({super.key, required this.item});

  @override
  Widget build(BuildContext context) {
    final colors = _riskColors(item.risk);
    final area = item.areaData;
    final score = area?['riskScore'];
    final riskLabelText = area?['riskLabel']?.toString();
    final districtTotal = area?['districtTotalCases'];
    final barangayCases = area?['cases'];

    return DraggableScrollableSheet(
      initialChildSize: 0.55,
      minChildSize: 0.4,
      maxChildSize: 0.92,
      expand: false,
      builder: (context, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              const SizedBox(height: 10),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFE5E7EB),
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color: colors.secondary,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            item.risk == RiskLevel.low
                                ? LucideIcons.bell
                                : LucideIcons.triangleAlert,
                            color: colors.primary,
                            size: 26,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.title,
                                style: GoogleFonts.inter(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w700,
                                  color: const Color(0xFF111827),
                                ),
                              ),
                              const SizedBox(height: 8),
                              _RiskPill(level: item.risk, band: item.riskBand),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    _detailSection(
                      title: 'Alert overview',
                      children: [
                        _detailRow(
                          LucideIcons.clock,
                          'Date & time',
                          item.formattedTimestamp,
                        ),
                        const SizedBox(height: 12),
                        _detailRow(
                          LucideIcons.shieldAlert,
                          'Severity',
                          '${item.riskBand} risk',
                        ),
                        if (item.avgIncidentRate != null) ...[
                          const SizedBox(height: 12),
                          _detailRow(
                            LucideIcons.activity,
                            'District avg. incident rate',
                            item.avgIncidentRate!.toStringAsFixed(1),
                          ),
                        ],
                        if (item.dataCoverage != null &&
                            item.dataCoverage!.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          _detailRow(
                            LucideIcons.database,
                            'Dataset coverage',
                            item.dataCoverage!,
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 20),
                    Text(
                      'Description',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF9CA3AF),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      item.message,
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        color: const Color(0xFF374151),
                        height: 1.45,
                      ),

                    ),
                    const SizedBox(height: 20),
                    _detailSection(
                      title: 'Affected location',
                      children: [
                        _detailRow(
                          LucideIcons.mapPin,
                          'Location',
                          item.location,
                        ),
                        if (barangayCases != null) ...[
                          const SizedBox(height: 12),
                          _detailRow(
                            LucideIcons.users,
                            'Cases in this barangay',
                            barangayCases.toString(),
                          ),
                        ],
                        if (districtTotal != null) ...[
                          const SizedBox(height: 12),
                          _detailRow(
                            LucideIcons.landmark,
                            'District total cases',
                            districtTotal.toString(),
                          ),
                        ],
                      ],
                    ),
                    if (riskLabelText != null && riskLabelText.isNotEmpty ||
                        score != null) ...[
                      const SizedBox(height: 20),
                      _detailSection(
                        title: 'Risk assessment',
                        children: [
                          if (riskLabelText != null &&
                              riskLabelText.isNotEmpty) ...[
                            _detailRow(
                              LucideIcons.shield,
                              'Risk classification',
                              riskLabelText,
                            ),
                          ],
                          if (score != null) ...[
                            if (riskLabelText != null &&
                                riskLabelText.isNotEmpty)
                              const SizedBox(height: 12),
                            _detailRow(
                              LucideIcons.gauge,
                              'Risk score',
                              score.toString(),
                            ),
                          ],
                        ],
                      ),
                    ],
                    const SizedBox(height: 20),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: _recommendationBg(item.risk),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: _recommendationBorder(item.risk)),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            LucideIcons.info,
                            size: 18,
                            color: _recommendationFg(item.risk),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              _recommendationFor(item.risk),
                              style: GoogleFonts.inter(
                                fontSize: 13,
                                color: _recommendationFg(item.risk),
                                height: 1.4,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () => Navigator.pop(context),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF2563EB),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: Text(
                          'Close',
                          style: GoogleFonts.inter(fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _detailSection({
    required String title,
    required List<Widget> children,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: GoogleFonts.inter(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: const Color(0xFF9CA3AF),
          ),
        ),
        const SizedBox(height: 10),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFFF9FAFB),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE5E7EB)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: children,
          ),
        ),
      ],
    );
  }

  Widget _detailRow(IconData icon, String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: const Color(0xFF6B7280)),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: GoogleFonts.inter(
                  fontSize: 11,
                  color: const Color(0xFF9CA3AF),
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: GoogleFonts.inter(
                  fontSize: 14,
                  color: const Color(0xFF374151),
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  String _recommendationFor(RiskLevel level) {
    switch (level) {
      case RiskLevel.critical:
        return 'Immediate caution advised. Avoid all high-risk food sources in this area, '
            'drink only safe water, wash hands thoroughly before eating, and seek medical '
            'attention promptly if you experience symptoms.';
      case RiskLevel.high:
        return 'Avoid high-risk food sources in this area. Wash hands frequently, '
            'ensure food is fully cooked, and seek medical attention if symptoms appear.';
      case RiskLevel.moderate:
        return 'Exercise caution with street food and uncooked items. Practice proper '
            'food handling and monitor for symptoms.';
      case RiskLevel.low:
        return 'Continue standard food safety practices. Stay informed about updates '
            'in your area.';
    }
  }

  Color _recommendationBg(RiskLevel level) {
    switch (level) {
      case RiskLevel.critical:
        return const Color(0xFFFEF2F2);
      case RiskLevel.high:
        return const Color(0xFFFFF7ED);
      case RiskLevel.moderate:
        return const Color(0xFFFFFBEB);
      case RiskLevel.low:
        return const Color(0xFFEFF6FF);
    }
  }

  Color _recommendationBorder(RiskLevel level) {
    switch (level) {
      case RiskLevel.critical:
        return const Color(0xFFFECACA);
      case RiskLevel.high:
        return const Color(0xFFFED7AA);
      case RiskLevel.moderate:
        return const Color(0xFFFDE68A);
      case RiskLevel.low:
        return const Color(0xFFDBEAFE);
    }
  }

  Color _recommendationFg(RiskLevel level) {
    switch (level) {
      case RiskLevel.critical:
        return const Color(0xFF991B1B);
      case RiskLevel.high:
        return const Color(0xFF9A3412);
      case RiskLevel.moderate:
        return const Color(0xFF92400E);
      case RiskLevel.low:
        return const Color(0xFF1E40AF);
    }
  }
}

class _MetaRow extends StatelessWidget {
  final IconData icon;
  final String text;

  const _MetaRow({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 14, color: const Color(0xFF6B7280)),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            text,
            overflow: TextOverflow.ellipsis,
            style: GoogleFonts.inter(
              fontSize: 12,
              color: const Color(0xFF6B7280),
            ),
          ),
        ),
      ],
    );
  }
}

class _RiskPill extends StatelessWidget {
  final RiskLevel level;
  final String? band;

  const _RiskPill({required this.level, this.band});

  @override
  Widget build(BuildContext context) {
    final style = _styleForLevel(level);
    final label = (band != null && band!.isNotEmpty) ? band! : style.label;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: style.bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: GoogleFonts.inter(
          fontSize: 11,
          color: style.fg,
          fontWeight: FontWeight.w600,
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
          label: 'High Risk',
        );
      case RiskLevel.moderate:
        return (
          bg: const Color(0xFFFEF3C7),
          fg: const Color(0xFFB45309),
          label: 'Moderate Risk',
        );
      case RiskLevel.low:
        return (
          bg: const Color(0xFFDCFCE7),
          fg: const Color(0xFF15803D),
          label: 'Low Risk',
        );
    }
  }
}

class _RiskColors {
  final Color primary;
  final Color secondary;

  const _RiskColors({
    required this.primary,
    required this.secondary,
  });
}

_RiskColors _riskColors(RiskLevel level) {
  switch (level) {
    case RiskLevel.critical:
      return const _RiskColors(
        primary: Color(0xFFFEE2E2),
        secondary: Color(0xFFDC2626),
      );
    case RiskLevel.high:
      return const _RiskColors(
        primary: Color(0xFFFFEDD5),
        secondary: Color(0xFFEA580C),
      );
    case RiskLevel.moderate:
      return const _RiskColors(
        secondary: Color(0xFFFEF3C7),
        primary: Color(0xFFD97706),
      );
    case RiskLevel.low:
      return const _RiskColors(
        secondary: Color(0xFFDCFCE7),
        primary: Color(0xFF16A34A),
      );
  }
}