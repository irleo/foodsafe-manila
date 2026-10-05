import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;
import 'package:shared_preferences/shared_preferences.dart';

import 'api_client.dart';
import 'session.dart';

class PolicyDocument {
  final String type;
  final String title;
  final String version;
  final String status;
  final String text;

  const PolicyDocument({
    required this.type,
    required this.title,
    required this.version,
    required this.status,
    required this.text,
  });

  factory PolicyDocument.fromJson(Map<String, dynamic> json) => PolicyDocument(
    type: json['type'] as String,
    title: json['title'] as String,
    version: json['version'] as String,
    status: json['status'] as String,
    text: json['text'] as String,
  );

  bool get published => status == 'published' || status == 'testing';

  /// Strip Markdown heading syntax at display time, including API documents.
  String get displayText =>
      text.replaceAll(RegExp(r'^[ \t]{0,3}#{1,6}[ \t]+', multiLine: true), '');
}

class PolicyBundle {
  final List<PolicyDocument> documents;
  final bool? healthConsentRequired;
  final String healthConsentText;
  final String lawfulBasis;

  PolicyBundle.fromJson(Map<String, dynamic> json)
    : documents = (json['policies'] as List<dynamic>)
          .map((item) => PolicyDocument.fromJson(item as Map<String, dynamic>))
          .toList(),
      healthConsentRequired =
          (json['reportingProcessing']
                  as Map<String, dynamic>)['consentRequired']
              as bool?,
      healthConsentText =
          (json['reportingProcessing'] as Map<String, dynamic>)['consentText']
              as String,
      lawfulBasis =
          (json['reportingProcessing'] as Map<String, dynamic>)['lawfulBasis']
              as String;

  PolicyDocument policy(String type) =>
      documents.firstWhere((doc) => doc.type == type);
  bool get accountPublished =>
      policy('terms').published && policy('privacy').published;
  bool get reportingPublished =>
      accountPublished &&
      policy('reporting').published &&
      policy('location').published &&
      healthConsentRequired != null &&
      lawfulBasis != 'pending_review' &&
      (healthConsentRequired != true || healthConsentText.trim().isNotEmpty);

  Map<String, Object> get accountChoices => {
    'terms': {'accepted': true, 'version': policy('terms').version},
    'privacy': {'accepted': true, 'version': policy('privacy').version},
  };
}

class PolicyService {
  static bool locationEnabled = false;
  static String? _locationVersion;
  static Future<bool> Function()? requestLocationDisclosure;

  static Future<void> initialize() async {
    final prefs = await SharedPreferences.getInstance();
    locationEnabled = prefs.getBool('policy_location_enabled') ?? false;
    _locationVersion = prefs.getString('policy_location_version');
  }

  static Future<PolicyBundle> loadBundled() async {
    final text = await rootBundle.loadString('assets/mobile-policies.json');
    return PolicyBundle.fromJson(jsonDecode(text) as Map<String, dynamic>);
  }

  static Future<PolicyBundle> load() async {
    try {
      final response = await ApiClient.get(
        '/auth/mobile/policies',
        auth: false,
      ).timeout(const Duration(seconds: 5));
      ApiClient.throwIfError(
        response,
        fallback: 'Policies could not be loaded.',
      );
      return PolicyBundle.fromJson(ApiClient.decodeMap(response));
    } catch (error) {
      // Reading notices must not depend on connectivity. The API still validates
      // the submitted versions before recording any acceptance.
      return loadBundled();
    }
  }

  static Future<bool> ensureLocationDisclosure() async {
    if (!locationEnabled) return false;
    try {
      final bundle = await load();
      final notice = bundle.policy('location');
      if (notice.published && _locationVersion == notice.version) return true;
      return await requestLocationDisclosure?.call() ?? false;
    } catch (_) {
      return false;
    }
  }

  static Future<void> setLocationEnabled(
    bool enabled, {
    String? version,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    locationEnabled = enabled;
    _locationVersion = enabled ? version : null;
    await prefs.setBool('policy_location_enabled', enabled);
    if (_locationVersion != null) {
      await prefs.setString('policy_location_version', _locationVersion!);
    } else {
      await prefs.remove('policy_location_version');
    }
  }

  static Future<bool> requiresAccountAcknowledgement() async {
    final response = await ApiClient.get(
      '/auth/mobile/policies/status',
    ).timeout(const Duration(seconds: 15));
    ApiClient.throwIfError(response);
    return ApiClient.decodeMap(response)['requiresAcknowledgement'] as bool;
  }

  static Future<void> acceptAccountPolicies(PolicyBundle bundle) async {
    final response = await ApiClient.post(
      '/auth/mobile/policies/accept',
      body: {'policyAcceptance': bundle.accountChoices},
      timeout: const Duration(seconds: 30),
    );
    ApiClient.throwIfError(response);
    await Session.saveCurrentUser(ApiClient.decodeMap(response));
  }

  static Future<ReportingPolicyStatus> reportingStatus(
    PolicyBundle bundle,
  ) async {
    final response = await ApiClient.get(
      '/auth/mobile/policies/status',
    ).timeout(const Duration(seconds: 15));
    ApiClient.throwIfError(response);
    final data = ApiClient.decodeMap(response);
    final receipt = data['reportingAcceptance'];
    final current =
        receipt is Map<String, dynamic> &&
        receipt['version'] == bundle.policy('reporting').version &&
        receipt['locationVersion'] == bundle.policy('location').version &&
        receipt['lawfulBasis'] == bundle.lawfulBasis &&
        (bundle.healthConsentRequired != true ||
            receipt['healthConsent'] == true);
    return ReportingPolicyStatus(
      accountAcknowledgementRequired: data['requiresAcknowledgement'] != false,
      reportingAcknowledgementRequired:
          data['requiresReportingAcknowledgement'] != false ||
          !current ||
          !bundle.reportingPublished,
      healthConsent:
          receipt is Map<String, dynamic> && receipt['healthConsent'] == true,
    );
  }

  static Future<void> acceptReportingPolicies(
    PolicyBundle bundle,
    bool healthConsent,
  ) async {
    final response = await ApiClient.post(
      '/auth/mobile/policies/reporting/accept',
      body: {
        'reportDisclosure': {
          'version': bundle.policy('reporting').version,
          'acknowledged': true,
          'locationVersion': bundle.policy('location').version,
          'locationAcknowledged': true,
          'healthConsent': healthConsent,
        },
      },
      timeout: const Duration(seconds: 30),
    );
    ApiClient.throwIfError(
      response,
      fallback: 'Reporting consent could not be saved.',
    );
  }
}

class ReportingPolicyStatus {
  final bool accountAcknowledgementRequired;
  final bool reportingAcknowledgementRequired;
  final bool healthConsent;

  const ReportingPolicyStatus({
    required this.accountAcknowledgementRequired,
    required this.reportingAcknowledgementRequired,
    required this.healthConsent,
  });
}
