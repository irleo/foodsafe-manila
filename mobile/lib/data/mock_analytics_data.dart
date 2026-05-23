import 'package:flutter/material.dart';
import '../widgets/analytics_widgets.dart';

class TrendPoint {
  final String label;
  final double value;
  TrendPoint(this.label, this.value);
}

class DistrictData {
  final String name;
  final double value;
  DistrictData(this.name, this.value);
}

class IllnessData {
  final String name;
  final double value;
  final Color color;
  IllnessData(this.name, this.value, this.color);
}

class AnalyticsBundle {
  final List<TrendPoint> trends;
  final List<TrendPoint> forecastTrends;
  final List<TrendPoint> predictedTrendsHistory;
  final List<DistrictData> districts;
  final List<IllnessData> illnesses;
  final int currentCases;
  final double percentChange;

  AnalyticsBundle({
    required this.trends,
    this.forecastTrends = const [],
    this.predictedTrendsHistory = const [],
    required this.districts,
    required this.illnesses,
    required this.currentCases,
    required this.percentChange,
  });
}

// ===========================
// MOCK DATA BY RANGE
// ===========================

class MockAnalyticsData {
  static AnalyticsBundle getData(TimeRange range) {
    switch (range) {
      case TimeRange.day:
        return _dayData();
      case TimeRange.week:
        return _weekData();
      case TimeRange.month:
        return _monthData();
    }
  }

  static AnalyticsBundle _dayData() {
    // TOTAL = 1280
    final trends = [
      TrendPoint('12 AM', 0),
      TrendPoint('4 AM', 0),
      TrendPoint('8 AM', 0),
      TrendPoint('12 PM', 3),
      TrendPoint('4 PM', 5),
      TrendPoint('8 PM', 1),
      TrendPoint('12 AM', 0),
    ];

    // TOTAL = 1280
    final districts = [
      DistrictData('Tondo', 4),
      DistrictData('Sampaloc', 2),
      DistrictData('Ermita', 0),
      DistrictData('Malate', 3),
      DistrictData('Paco', 0),
    ];

    // TOTAL = 1280
    final illnesses = [
      IllnessData('Food Poisoning', 220, const Color(0xFF3B82F6)),
      IllnessData('E. Coli', 120, const Color(0xFFEC4899)),
      IllnessData('Norovirus', 80, const Color(0xFFF59E0B)),
      IllnessData('Salmonella', 180, const Color(0xFF8B5CF6)),
      IllnessData('Others', 55, const Color(0xFF10B981)),
    ];
    
    int total = trends.fold(0, (sum, e) => sum + e.value.toInt());
    
    return AnalyticsBundle(
      currentCases: total,
      percentChange: 6.2,
      trends: trends,
      districts: districts,
      illnesses: illnesses,
    );
  }

  // ---------- WEEK ----------
  static AnalyticsBundle _weekData() {
    final trends = [
      TrendPoint('Mon', 11),
      TrendPoint('Tue', 7),
      TrendPoint('Wed', 8),
      TrendPoint('Thu', 9),
      TrendPoint('Fri', 18),
      TrendPoint('Sat', 15),
      TrendPoint('Sun', 12),
    ];

    final forecastTrends = [
      TrendPoint('Mon', 13),
      TrendPoint('Tue', 5),
      TrendPoint('Wed', 10),
      TrendPoint('Thu', 7),
      TrendPoint('Fri', 20),
      TrendPoint('Sat', 13),
      TrendPoint('Sun', 14),
    ];
  
    final predictedTrendsHistory = [
      TrendPoint('Mon', 9),
      TrendPoint('Tue', 9),
      TrendPoint('Wed', 6),
      TrendPoint('Thu', 11),
      TrendPoint('Fri', 16),
      TrendPoint('Sat', 17),
      TrendPoint('Sun', 10),
    ];

    final districts = [
      DistrictData('Tondo', 38),
      DistrictData('Sampaloc', 12),
      DistrictData('Ermita', 8),
      DistrictData('Malate', 20),
      DistrictData('Paco', 2),
    ];

    final illnesses = [
      IllnessData('Food Poisoning', 34, const Color(0xFF3B82F6)),
      IllnessData('E. Coli', 6, const Color(0xFFEC4899)),
      IllnessData('Norovirus', 5, const Color(0xFFF59E0B)),
      IllnessData('Salmonella', 26, const Color(0xFF8B5CF6)),
      IllnessData('Others', 9, const Color(0xFF10B981)),
    ];

    // 🔥 AUTO TOTAL (from trends)
    int total = trends.fold(0, (sum, e) => sum + e.value.toInt());

    return AnalyticsBundle(
      currentCases: total, // <-- USE TOTAL HERE
      percentChange: 34.1,
      trends: trends,
      forecastTrends: forecastTrends,
      predictedTrendsHistory: predictedTrendsHistory,
      districts: districts,
      illnesses: illnesses,
    );
  }

  // ---------- MONTH ----------
  static AnalyticsBundle _monthData() {
    // TOTAL = 320
    final trends = [
      TrendPoint('Jan', 20),
      TrendPoint('Feb', 25),
      TrendPoint('Mar', 30),
      TrendPoint('Apr', 28),
      TrendPoint('May', 35),
      TrendPoint('Jun', 40),
      TrendPoint('Jul', 38),
      TrendPoint('Aug', 32),
      TrendPoint('Sep', 27),
      TrendPoint('Oct', 22),
      TrendPoint('Nov', 13),
      TrendPoint('Dec', 10),
    ];

    // TOTAL = 320
    final districts = [
      DistrictData('Tondo', 100),
      DistrictData('Sampaloc', 70),
      DistrictData('Ermita', 50),
      DistrictData('Malate', 40),
      DistrictData('Paco', 60),
    ];

    // TOTAL = 320
    final illnesses = [
      IllnessData('Food Poisoning', 110, const Color(0xFF3B82F6)),
      IllnessData('E. Coli', 60, const Color(0xFFEC4899)),
      IllnessData('Norovirus', 50, const Color(0xFFF59E0B)),
      IllnessData('Salmonella', 70, const Color(0xFF8B5CF6)),
      IllnessData('Others', 30, const Color(0xFF10B981)),
    ];

    int total = trends.fold(0, (sum, e) => sum + e.value.toInt());

    return AnalyticsBundle(
      currentCases: total,
      percentChange: 12.5,
      trends: trends,
      districts: districts,
      illnesses: illnesses,
    );
  }
}
