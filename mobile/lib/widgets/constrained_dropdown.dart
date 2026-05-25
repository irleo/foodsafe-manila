import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

/// Dropdown with a fixed maximum menu height so long lists scroll instead of
/// covering the full viewport.
class ConstrainedDropdown extends StatelessWidget {
  static const double defaultMenuMaxHeight = 280;

  final String label;
  final String value;
  final List<String> items;
  final ValueChanged<String?> onChanged;
  final String Function(String item, String label)? formatItem;
  final double menuMaxHeight;

  const ConstrainedDropdown({
    super.key,
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
    this.formatItem,
    this.menuMaxHeight = defaultMenuMaxHeight,
  });

  @override
  Widget build(BuildContext context) {
    final safeItems = items.isEmpty ? ['All'] : items;
    final safeValue = safeItems.contains(value) ? value : safeItems.first;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 10,
            fontWeight: FontWeight.bold,
            color: Colors.black45,
          ),
        ),
        const SizedBox(height: 4),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(
            border: Border.all(color: Colors.grey.shade400),
            borderRadius: BorderRadius.circular(8),
            color: Colors.white,
          ),
          child: DropdownButton<String>(
            isDense: true,
            isExpanded: true,
            value: safeValue,
            underline: const SizedBox(),
            dropdownColor: Colors.white,
            menuMaxHeight: menuMaxHeight,
            menuWidth: 120,
            icon: Icon(LucideIcons.chevronDown, size: 16),
            style: GoogleFonts.inter(fontSize: 12, color: Colors.black87),

            // ✅ THIS controls the selected value display (button)
            selectedItemBuilder: (BuildContext context) {
              return safeItems.map((item) {
                final text = formatItem?.call(item, label) ?? _defaultFormat(item, label);

                return Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    text,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    softWrap: false,
                  ),
                );
              }).toList();
            },

            items: safeItems.map((item) {
              final text = formatItem?.call(item, label) ?? _defaultFormat(item, label);

              return DropdownMenuItem(
                value: item,
                child: Text(
                  text,
                  // ❌ no ellipsis here → full text in dropdown
                  softWrap: true,
                  overflow: TextOverflow.visible,
                ),
              );
            }).toList(),

            onChanged: onChanged,
          ),
        ),
      ],
    );
  }

  static String _defaultFormat(String item, String label) {
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

    if (item == 'all' || item == 'All') {
      if (label == 'Month') return 'All Months';
      if (label == 'Classification') return 'All Classifications';
      if (label == 'Year') return 'All Years';
      if (label == 'Disease') return 'All Diseases';
      if (label == 'Time Range') return 'All';
      return 'All';
    }

    if (label == 'Time Range') return '$item months';
    if (months.containsKey(item)) return months[item]!;

    if (item.isEmpty) return item;
    return item[0].toUpperCase() + item.substring(1).toLowerCase();
  }
}
