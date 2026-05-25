import 'package:flutter/material.dart';

/// Risk band and heatmap builders aligned with the web dashboard
/// (`frontend/src/utils/heatmapCaseBuilders.js`).
class HeatmapCaseBuilders {
  static String getRiskBand(num cases) {
    if (cases >= 31) return 'Critical';
    if (cases >= 16) return 'High';
    if (cases >= 6) return 'Medium';
    return 'Low';
  }

  static Color getRiskColor(num cases) {
    switch (getRiskBand(cases)) {
      case 'Critical':
        return const Color(0xFFEF4444);
      case 'High':
        return const Color(0xFFF97316);
      case 'Medium':
        return const Color(0xFFEAB308);
      default:
        return const Color(0xFF22C55E);
    }
  }

  static Map<String, int> buildRiskStatsFromDistrictPoints(
    List<Map<String, dynamic>> points,
  ) {
    final stats = {'Low': 0, 'Medium': 0, 'High': 0, 'Critical': 0};
    for (final p in points) {
      final avg = p['avgIncidentPerBarangay'] ?? p['districtAvgIncident'];
      final cases = p['cases'];
      final risk = p['risk']?.toString() ??
          getRiskBand(
            (avg is num)
                ? avg
                : (cases is num ? cases : 0),
          );
      if (stats.containsKey(risk)) {
        stats[risk] = stats[risk]! + 1;
      }
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
