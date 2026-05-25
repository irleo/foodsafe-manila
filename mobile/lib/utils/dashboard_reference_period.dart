import 'package:intl/intl.dart';

/// Formats the shared dashboard reference period from dataset coverage metadata.
class DashboardReferencePeriod {
  static String format(dynamic raw) {
    if (raw is Map) {
      final start = DateTime.tryParse(raw['coverageStart']?.toString() ?? '');
      final end = DateTime.tryParse(raw['coverageEnd']?.toString() ?? '');
      if (start != null && end != null) {
        final label = DateFormat('MMM yyyy');
        return '${label.format(start)}–${label.format(end)}';
      }
    }
    return _currentYearRange();
  }

  static String _currentYearRange() {
    final now = DateTime.now();
    final start = DateTime(now.year, 1, 1);
    final formatter = DateFormat('MMM d');
    return '${formatter.format(start)}–${formatter.format(now)}, ${now.year}';
  }
}
