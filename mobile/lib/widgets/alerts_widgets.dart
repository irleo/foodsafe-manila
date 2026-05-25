import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

enum RiskLevel { high, moderate, low }

class AlertItem {
  final String title;
  final RiskLevel risk;
  final String message;
  final String location;
  final String timeAgo;
  final String cases;
  final String distance;
  final Map<String, dynamic>? areaData;

  const AlertItem({
    required this.title,
    required this.risk,
    required this.message,
    required this.location,
    required this.timeAgo,
    required this.cases,
    required this.distance,
    this.areaData,
  });
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
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: isUnread
            ? Border(
                left: BorderSide(color: colors.border, width: 4),
                top: BorderSide(color: colors.border),
                right: BorderSide(color: colors.border),
                bottom: BorderSide(color: colors.border),
              )
            : null,
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
          // icon bubble
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(color: colors.bg, shape: BoxShape.circle),
            child: Icon(
              item.risk == RiskLevel.low
                  ? LucideIcons.bell
                  : LucideIcons.triangleAlert,
              color: colors.icon,
              size: 26,
            ),
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
                          color: item.risk == RiskLevel.high
                              ? const Color(0xFF111827)
                              : const Color(0xFF374151),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    _RiskPill(level: item.risk),
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
                    Expanded(
                      child: _MetaRow(
                        icon: LucideIcons.clock,
                        text: item.timeAgo,
                      ),
                    ),
                  ],
                ),
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
    final official = area?['officialCases'];
    final suspected = area?['suspectedCases'];
    final total = area?['totalCases'];
    final score = area?['riskScore'];
    final riskLabelText = area?['riskLabel']?.toString();

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
                            color: colors.bg,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            item.risk == RiskLevel.low
                                ? LucideIcons.bell
                                : LucideIcons.triangleAlert,
                            color: colors.icon,
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
                              _RiskPill(level: item.risk),
                            ],
                          ),
                        ),
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
                    _detailRow(LucideIcons.mapPin, 'Location', item.location),
                    const SizedBox(height: 12),
                    _detailRow(LucideIcons.clock, 'Reported', item.timeAgo),
                    if (riskLabelText != null && riskLabelText.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      _detailRow(
                        LucideIcons.shield,
                        'Risk classification',
                        riskLabelText,
                      ),
                    ],
                    if (score != null) ...[
                      const SizedBox(height: 12),
                      _detailRow(
                        LucideIcons.activity,
                        'Risk score',
                        score.toString(),
                      ),
                    ],
                    if (total != null || official != null || suspected != null) ...[
                      const SizedBox(height: 20),
                      Text(
                        'Case breakdown',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFF9CA3AF),
                        ),
                      ),
                      const SizedBox(height: 10),
                      if (total != null)
                        _detailChip('Total cases', total.toString()),
                      if (official != null) ...[
                        const SizedBox(height: 8),
                        _detailChip('Official cases', official.toString()),
                      ],
                      if (suspected != null) ...[
                        const SizedBox(height: 8),
                        _detailChip('Suspected reports', suspected.toString()),
                      ],
                    ],
                    const SizedBox(height: 20),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFDBEAFE)),
                      ),
                      child: Text(
                        _recommendationFor(item.risk),
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          color: const Color(0xFF1E40AF),
                          height: 1.4,
                        ),
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

  Widget _detailChip(String label, String value) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF9FAFB),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFF3F4F6)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF6B7280)),
          ),
          Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: const Color(0xFF111827),
            ),
          ),
        ],
      ),
    );
  }

  String _recommendationFor(RiskLevel level) {
    switch (level) {
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
  const _RiskPill({required this.level});

  @override
  Widget build(BuildContext context) {
    late final Color bg;
    late final Color fg;
    late final String label;

    switch (level) {
      case RiskLevel.high:
        bg = const Color(0xFFFEE2E2);
        fg = const Color(0xFFB91C1C);
        label = "High Risk";
        break;
      case RiskLevel.moderate:
        bg = const Color(0xFFFEF3C7);
        fg = const Color(0xFFB45309);
        label = "Moderate Risk";
        break;
      case RiskLevel.low:
        bg = const Color(0xFFDCFCE7);
        fg = const Color(0xFF15803D);
        label = "Low Risk";
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: GoogleFonts.inter(
          fontSize: 11,
          color: fg,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _RiskColors {
  final Color border;
  final Color bg;
  final Color icon;

  const _RiskColors({
    required this.border,
    required this.bg,
    required this.icon,
  });
}

_RiskColors _riskColors(RiskLevel level) {
  switch (level) {
    case RiskLevel.high:
      return const _RiskColors(
        border: Color(0xFFFECACA),
        bg: Color(0xFFFEE2E2),
        icon: Color(0xFFDC2626),
      );
    case RiskLevel.moderate:
      return const _RiskColors(
        border: Color(0xFFFDE68A),
        bg: Color(0xFFFEF3C7),
        icon: Color(0xFFD97706),
      );
    case RiskLevel.low:
      return const _RiskColors(
        border: Color(0xFFF3F4F6),
        bg: Color(0xFFDCFCE7),
        icon: Color(0xFF16A34A),
      );
  }
}