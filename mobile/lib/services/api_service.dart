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
    required String verificationToken,
    String? email,
  }) async {
    final response = await ApiClient.post(
      '/auth/register',
      body: {
        'username': username,
        'phone': phone,
        'password': password,
        'verificationToken': verificationToken,
        'email': email ?? '',
      },
      auth: false,
    );

    ApiClient.throwIfError(response, fallback: 'Failed to create account');
    return response.statusCode == 201;
  }

  static Future<int> sendMobileOtp({
    required String phone,
    required String purpose,
  }) async {
    final response = await ApiClient.post(
      '/auth/mobile/otp/send',
      body: {'phone': phone, 'purpose': purpose},
      auth: false,
    );

    ApiClient.throwIfError(
      response,
      fallback: 'Failed to send verification code',
    );
    final data = ApiClient.decodeMap(response);
    return data['expiresInSeconds'] as int? ?? 300;
  }

  static Future<String> verifyMobileOtp({
    required String phone,
    required String purpose,
    required String otp,
  }) async {
    final response = await ApiClient.post(
      '/auth/mobile/otp/verify',
      body: {'phone': phone, 'purpose': purpose, 'otp': otp},
      auth: false,
    );

    ApiClient.throwIfError(response, fallback: 'Failed to verify code');
    final data = ApiClient.decodeMap(response);
    final token = data['verificationToken'] as String?;
    if (token == null || token.isEmpty) {
      throw ApiException(response.statusCode, 'Verification token is missing');
    }
    return token;
  }

  static Future<bool> checkPhoneExists(String phone) async {
    final response = await ApiClient.get(
      '/auth/user/exists',
      query: {'phone': phone},
      auth: false,
    );

    ApiClient.throwIfError(response, fallback: 'Failed to check mobile number');

    final data = ApiClient.decodeMap(response);
    return data['exists'] as bool? ?? false;
  }

  static Future<bool> updatePassword({
    required String phone,
    required String newPassword,
    required String verificationToken,
  }) async {
    final response = await ApiClient.post(
      '/auth/reset-password',
      body: {
        'phone': phone,
        'newPassword': newPassword,
        'verificationToken': verificationToken,
      },
      auth: false,
    );

    ApiClient.throwIfError(response, fallback: 'Failed to update password');
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
      body: {'username': username, 'phone': phone, 'email': email ?? ''},
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

  static Future<Map<String, dynamic>> getUserReports(
    String userId, {
    int page = 1,
    int limit = 10,
  }) async {
    final response = await ApiClient.get(
      '/reports/user/$userId',
      query: {'page': '$page', 'limit': '$limit'},
    );

    if (response.statusCode != 200) {
      return {'items': <Map<String, dynamic>>[], 'pagination': null};
    }

    return ApiClient.decodeMap(response);
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

  static Future<Map<String, dynamic>?> getRiskHeatmap({
    String months = '12',
  }) async {
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
      query: {'status': 'validated', 'page': '1', 'limit': '1'},
    );
    if (response.statusCode != 200) return null;

    final data = ApiClient.decodeMap(response);
    final rawItems = data['items'];
    final rows = rawItems is List
        ? rawItems
              .whereType<Map>()
              .map((row) => Map<String, dynamic>.from(row))
              .toList()
        : <Map<String, dynamic>>[];
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
    int limit = 50,
  }) async {
    final pageSize = limit.clamp(1, 50);
    final rows = <Map<String, dynamic>>[];
    var page = 1;
    var totalPages = 1;

    do {
      final response = await ApiClient.get(
        '/cases/$datasetId',
        query: {'page': '$page', 'limit': '$pageSize'},
      );
      if (response.statusCode != 200) return rows;

      final data = ApiClient.decodeMap(response);
      final items = data['items'];
      if (items is List) {
        rows.addAll(
          items.whereType<Map>().map((row) => Map<String, dynamic>.from(row)),
        );
      }
      final pagination = data['pagination'];
      totalPages = pagination is Map
          ? (pagination['totalPages'] as num?)?.toInt() ?? 1
          : 1;
      page += 1;
    } while (page <= totalPages);

    return rows;
  }

  /// District/barangay heatmap — mirrors web `GET /api/heatmap/districts`.
  static Future<Map<String, dynamic>?> fetchDistrictHeatmap({
    required String datasetId,
    String selectedYear = 'All',
    String selectedMonth = 'All',
    String selectedDisease = 'All',
    String selectedCaseClassification = 'confirmed',
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
