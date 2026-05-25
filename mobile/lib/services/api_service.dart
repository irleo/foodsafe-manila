import 'api_client.dart';
import 'session.dart';

class ApiService {
  static Future<Map<String, dynamic>?> login(
    String phone,
    String password,
  ) async {
    final response = await ApiClient.post(
      '/auth/login',
      body: {'phone': phone, 'password': password},
      auth: false,
    );

    if (response.statusCode != 200) return null;

    final data = ApiClient.decodeMap(response);
    final accessToken = data['accessToken'] as String?;
    final refreshToken = data['refreshToken'] as String?;

    if (accessToken == null) return null;

    await Session.saveTokens(
      accessToken: accessToken,
      refreshToken: refreshToken,
      user: data,
    );

    return Session.currentUser;
  }

  static Future<bool> registerUser({
    required String username,
    required String phone,
    required String password,
    String? email,
  }) async {
    final response = await ApiClient.post(
      '/auth/register',
      body: {
        'username': username,
        'phone': phone,
        'password': password,
        'email': email ?? '',
      },
      auth: false,
    );

    return response.statusCode == 201;
  }

  static Future<bool> checkPhoneExists(String phone) async {
    final response = await ApiClient.get(
      '/auth/user/exists',
      query: {'phone': phone},
      auth: false,
    );

    if (response.statusCode != 200) return false;

    final data = ApiClient.decodeMap(response);
    return data['exists'] as bool? ?? false;
  }

  static Future<bool> updatePassword({
    required String phone,
    required String newPassword,
  }) async {
    final response = await ApiClient.post(
      '/auth/reset-password',
      body: {'phone': phone, 'newPassword': newPassword},
      auth: false,
    );

    return response.statusCode == 200;
  }

  static Future<Map<String, dynamic>?> updateUser({
    required String id,
    required String username,
    required String phone,
    String? email,
  }) async {
    final response = await ApiClient.put(
      '/users/$id',
      body: {
        'username': username,
        'phone': phone,
        'email': email ?? '',
      },
    );

    if (response.statusCode != 200) return null;

    final data = ApiClient.decodeMap(response);
    await Session.saveCurrentUser(data);
    return data;
  }

  static Future<bool> submitReport({
    required String reportLocation,
    required List<String> symptoms,
    required String foodSource,
    required String? exposureDistrict,
    String? exposureBarangay,
    int? exposureBarangayNo,
    required Map<String, dynamic> location,
  }) async {
    final response = await ApiClient.post(
      '/reports',
      body: {
        'reportLocation': reportLocation,
        'symptoms': symptoms,
        'foodSource': foodSource,
        'exposureDistrict': exposureDistrict,
        'exposureBarangay': exposureBarangay,
        'exposureBarangayNo': exposureBarangayNo,
        'caseClassification': 'suspected',
        'location': location,
      },
    );

    if (response.statusCode == 201) return true;

    try {
      ApiClient.throwIfError(response, fallback: 'Failed to submit report');
    } on ApiException {
      rethrow;
    }

    return false;
  }

  static Future<List<Map<String, dynamic>>> getUserReports(
    String userId,
  ) async {
    final response = await ApiClient.get('/reports/user/$userId');

    if (response.statusCode != 200) return [];

    return ApiClient.decodeList(response);
  }

  static Future<DateTime?> getLastReportTime(String userId) async {
    final response = await ApiClient.get('/reports/user/$userId/last');

    if (response.statusCode != 200) return null;

    final data = ApiClient.decodeMap(response);
    final raw = data['lastReportAt'] as String?;
    return raw == null ? null : DateTime.tryParse(raw);
  }

  static Future<Map<String, dynamic>?> getOfficialAnalytics({
    String? year,
    String? month,
    String? caseClassification,
    bool includeReports = true,
  }) async {
    final query = <String, String>{
      if (year != null && year != 'all') 'year': year,
      if (month != null && month != 'all') 'month': month,
      if (caseClassification != null && caseClassification != 'all')
        'caseClassification': caseClassification,
      if (!includeReports) 'includeReports': 'false',
    };

    final response = await ApiClient.get(
      '/official-cases/analytics',
      query: query,
    );

    if (response.statusCode != 200) return null;
    return ApiClient.decodeMap(response);
  }

  static Future<Map<String, dynamic>> fetchLatestPredictions({
    String? datasetId,
    String? districtKey,
    String? district,
  }) async {
    final query = <String, String>{
      if (datasetId != null) 'datasetId': datasetId,
      if (districtKey != null) 'districtKey': districtKey,
      if (district != null) 'district': district,
    };

    final response = await ApiClient.get(
      '/predictions',
      query: query.isNotEmpty ? query : null,
    );

    ApiClient.throwIfError(response, fallback: 'Prediction request failed');
    return ApiClient.decodeMap(response);
  }

  static Future<Map<String, dynamic>?> getDashboard() async {
    final response = await ApiClient.get('/dashboard');
    if (response.statusCode != 200) return null;
    return ApiClient.decodeMap(response);
  }

  static Future<Map<String, dynamic>?> getRiskHeatmap({String months = '12'}) async {
    final response = await ApiClient.get(
      '/risk/heatmap',
      query: {'months': months},
    );
    if (response.statusCode != 200) return null;
    return ApiClient.decodeMap(response);
  }

  /// Newest validated dataset (same scope as web `useLatestDatasetId`).
  static Future<String?> fetchLatestValidatedDatasetId() async {
    final dataset = await fetchLatestValidatedDataset();
    return dataset?['id']?.toString();
  }

  /// Newest validated dataset row including coverage metadata.
  static Future<Map<String, dynamic>?> fetchLatestValidatedDataset() async {
    final response = await ApiClient.get(
      '/datasets',
      query: {'status': 'validated'},
    );
    if (response.statusCode != 200) return null;

    final rows = ApiClient.decodeList(response);
    if (rows.isEmpty) return null;

    final row = rows.first;
    final id = row['_id'] ?? row['id'];
    return {
      'id': id?.toString(),
      'coverageStart': row['coverageStart'],
      'coverageEnd': row['coverageEnd'],
    };
  }

  /// Official case rows for a dataset (no classification filter = all types).
  static Future<List<Map<String, dynamic>>> fetchOfficialCasesByDataset(
    String datasetId, {
    int limit = 1000,
  }) async {
    final response = await ApiClient.get(
      '/cases/$datasetId',
      query: {'limit': '$limit'},
    );
    if (response.statusCode != 200) return [];

    final data = ApiClient.decodeMap(response);
    final items = data['items'];
    if (items is! List) return [];

    return items
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
  }

  /// District/barangay heatmap — mirrors web `GET /api/heatmap/districts`.
  static Future<Map<String, dynamic>?> fetchDistrictHeatmap({
    required String datasetId,
    String selectedYear = 'All',
    String selectedMonth = 'All',
    String selectedDisease = 'All',
    String selectedCaseClassification = 'All',
  }) async {
    final query = <String, String>{'datasetId': datasetId};
    if (selectedYear != 'All') query['year'] = selectedYear;
    if (selectedMonth != 'All') query['month'] = selectedMonth;
    if (selectedDisease != 'All') query['disease'] = selectedDisease;
    if (selectedCaseClassification != 'All') {
      query['caseClassification'] = selectedCaseClassification;
    }

    final response = await ApiClient.get('/heatmap/districts', query: query);
    if (response.statusCode != 200) return null;
    return ApiClient.decodeMap(response);
  }

  static Future<Map<String, dynamic>?> getNearbyRisk({
    int? barangayNo,
    double? lat,
    double? lng,
  }) async {
    final query = <String, String>{
      if (barangayNo != null) 'barangayNo': '$barangayNo',
      if (lat != null) 'lat': '$lat',
      if (lng != null) 'lng': '$lng',
    };

    final response = await ApiClient.get('/risk/nearby', query: query);
    if (response.statusCode != 200) return null;
    return ApiClient.decodeMap(response);
  }
}
