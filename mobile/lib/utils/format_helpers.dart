/// Shared display and payload formatting for locations and symptoms.
class FormatHelpers {
  /// `district_4` → `District 4`, `District 4` unchanged.
  static String normalizeDistrict(String? value) {
    final raw = (value ?? '').trim();
    if (raw.isEmpty) return 'Unknown';
    final cleaned = raw
        .replaceAll(RegExp(r'[_-]+'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
    final match =
        RegExp(r'^district\s*(\d+)$', caseSensitive: false).firstMatch(cleaned);
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

  /// `District 4` + barangay number → `District 4, Barangay 407`.
  static String formatLocationDisplay({
    required String district,
    int? barangayNo,
    String? barangayName,
  }) {
    final normalizedDistrict = normalizeDistrict(district);
    if (barangayNo != null && barangayNo > 0) {
      return '$normalizedDistrict, Barangay $barangayNo';
    }
    final name = (barangayName ?? '').trim();
    if (name.isNotEmpty) return '$normalizedDistrict, $name';
    return normalizedDistrict;
  }

  /// `abdominal_cramps` → `Abdominal Cramps`.
  static String formatSymptom(String value) {
    final cleaned = value.trim().replaceAll('_', ' ');
    if (cleaned.isEmpty) return value;
    return cleaned
        .split(RegExp(r'\s+'))
        .map(
          (word) => word.isEmpty
              ? word
              : '${word[0].toUpperCase()}${word.substring(1).toLowerCase()}',
        )
        .join(' ');
  }

  static List<String> formatSymptoms(Iterable<String> values) {
    return values.map(formatSymptom).toList();
  }
}
