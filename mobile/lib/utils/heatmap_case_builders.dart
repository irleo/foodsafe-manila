import 'package:flutter/material.dart';

/// Case-concentration builders aligned with the web dashboard.
/// (`frontend/src/utils/heatmapCaseBuilders.js`).
class HeatmapCaseBuilders {
  static Color getConcentrationColor(num cases, num maximumCases) {
    final ratio = maximumCases > 0 ? cases / maximumCases : 0;
    if (ratio >= 0.75) return const Color(0xFF1E3A8A);
    if (ratio >= 0.5) return const Color(0xFF2563EB);
    if (ratio >= 0.25) return const Color(0xFF60A5FA);
    if (ratio > 0) return const Color(0xFFBFDBFE);
    return const Color(0xFFE5E7EB);
  }

  static Map<String, int> buildRiskStatsFromDistrictPoints(
    List<Map<String, dynamic>> points,
  ) {
    final stats = {'Cases': 0, 'Districts': 0, 'Barangays': 0, 'Average': 0};
    for (final p in points) {
      final cases = p['totalCases'] ?? p['districtTotalCases'] ?? p['cases'];
      final value = cases is num ? cases.toInt() : int.tryParse('$cases') ?? 0;
      stats['Cases'] = stats['Cases']! + value;
      if (value > 0) stats['Districts'] = stats['Districts']! + 1;
      final barangays = p['barangayCount'];
      stats['Barangays'] = stats['Barangays']! + (barangays is num ? barangays.toInt() : 0);
    }
    if (stats['Districts']! > 0) {
      stats['Average'] = (stats['Cases']! / stats['Districts']!).round();
    }
    return stats;
  }

  static List<Map<String, dynamic>> buildTopDistrictsFromPoints(
    List<Map<String, dynamic>> points, {
    int limit = 5,
  }) {
    final sorted = [...points]
      ..sort((a, b) {
        final bCases =
            (b['totalCases'] ?? b['districtTotalCases'] ?? b['cases'] ?? 0)
                as num;
        final aCases =
            (a['totalCases'] ?? a['districtTotalCases'] ?? a['cases'] ?? 0)
                as num;
        return bCases.compareTo(aCases);
      });

    return sorted.take(limit).map((p) {
      return {
        'name': p['district']?.toString() ?? '',
        'cases': (p['totalCases'] ??
                p['districtTotalCases'] ??
                p['cases'] ??
                0) as num,
      };
    }).toList();
  }

  /// Mirrors `buildTopDiseasesFromCases` in web `heatmapCaseBuilders.js`.
  static List<Map<String, dynamic>> buildTopDiseasesFromCases(
    List<Map<String, dynamic>> caseRows, {
    int limit = 5,
  }) {
    final totals = <String, num>{};

    for (final row in caseRows) {
      final disease = (row['disease']?.toString() ?? 'Unknown').trim();
      final cases = row['cases'];
      final n = cases is num ? cases : num.tryParse('$cases') ?? 0;
      if (n < 0) continue;
      totals[disease] = (totals[disease] ?? 0) + n;
    }

    final sorted = totals.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return sorted.take(limit).map((entry) {
      return {'name': entry.key, 'cases': entry.value};
    }).toList();
  }

  /// Summary metrics from official case rows (all classifications in [caseRows]).
  static Map<String, dynamic> buildDashboardSummaryFromCases(
    List<Map<String, dynamic>> caseRows,
  ) {
    final diseaseTotals = <String, num>{};
    final districtTotals = <String, num>{};
    final yearTotals = <int, num>{};
    num totalCases = 0;

    for (final row in caseRows) {
      final cases = row['cases'];
      final n = cases is num ? cases : num.tryParse('$cases') ?? 0;
      if (n < 0) continue;
      totalCases += n;

      final disease = (row['disease']?.toString() ?? '').trim();
      final district = (row['district']?.toString() ?? '').trim();
      final yearRaw = row['year'];
      final year = yearRaw is num
          ? yearRaw.toInt()
          : int.tryParse('$yearRaw');

      if (disease.isNotEmpty) {
        diseaseTotals[disease] = (diseaseTotals[disease] ?? 0) + n;
      }
      if (district.isNotEmpty) {
        districtTotals[district] = (districtTotals[district] ?? 0) + n;
      }
      if (year != null) {
        yearTotals[year] = (yearTotals[year] ?? 0) + n;
      }
    }

    String topDisease = 'N/A';
    var topDiseaseCases = -1.0;
    for (final entry in diseaseTotals.entries) {
      if (entry.value > topDiseaseCases) {
        topDisease = entry.key;
        topDiseaseCases = entry.value.toDouble();
      }
    }

    String topDistrict = 'N/A';
    var topDistrictCases = -1.0;
    for (final entry in districtTotals.entries) {
      if (entry.value > topDistrictCases) {
        topDistrict = entry.key;
        topDistrictCases = entry.value.toDouble();
      }
    }

    final years = yearTotals.keys.toList()..sort((a, b) => b.compareTo(a));
    var growth = 0.0;
    if (years.length >= 2) {
      final current = yearTotals[years[0]] ?? 0;
      final previous = yearTotals[years[1]] ?? 0;
      if (previous > 0) {
        growth = ((current - previous) / previous) * 100;
      }
    }

    return {
      'totalCases': totalCases,
      'topDisease': topDisease,
      'topDistrict': topDistrict,
      'growth': growth.toStringAsFixed(1),
    };
  }
}
