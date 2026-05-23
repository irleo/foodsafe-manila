import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

enum RiskLevel { high, moderate, low }

class AlertItem {
  final String title;
  final RiskLevel risk;
  final String message;
  final String location;
  final String timeAgo;
  final String cases;
  final String distance;

  const AlertItem({
    required this.title,
    required this.risk,
    required this.message,
    required this.location,
    required this.timeAgo,
    required this.cases,
    required this.distance,
  });
}

class AlertCard extends StatelessWidget {
  final AlertItem item;
  final bool isUnread;

  const AlertCard({
    super.key,
    required this.item,
    this.isUnread = true,
  });

  @override
  Widget build(BuildContext context) {
    final colors = _riskColors(item.risk);

    return Container(
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
                  ? Icons.notifications_rounded
                  : Icons.warning_amber_rounded,
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
                        icon: Icons.location_on_outlined,
                        text: item.location,
                      ),
                    ),
                    Expanded(
                      child: _MetaRow(
                        icon: Icons.access_time_rounded,
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
    );
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