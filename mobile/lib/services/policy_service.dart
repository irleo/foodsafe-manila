import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;

import 'package:foodsafe_manila/services/api_client.dart';
import 'package:foodsafe_manila/services/session.dart';

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
        fallback: "We couldn't load the account policies. Please try again.",
      );
      return PolicyBundle.fromJson(ApiClient.decodeMap(response));
    } catch (error) {
      // Reading notices must not depend on connectivity. The API still validates
      // the submitted versions before recording any acceptance.
      return loadBundled();
    }
  }

  static Future<bool> requiresAccountAcknowledgement() async {
    final response = await ApiClient.get(
      '/auth/mobile/policies/status',
    ).timeout(const Duration(seconds: 15));
    ApiClient.throwIfError(
      response,
      fallback:
          "We couldn't check your policy acknowledgement. Please try again.",
    );
    return ApiClient.decodeMap(response)['requiresAcknowledgement'] as bool;
  }

  static Future<void> acceptAccountPolicies(PolicyBundle bundle) async {
    final response = await ApiClient.post(
      '/auth/mobile/policies/accept',
      body: {'policyAcceptance': bundle.accountChoices},
      timeout: const Duration(seconds: 30),
    );
    ApiClient.throwIfError(
      response,
      fallback:
          "We couldn't save your policy acknowledgement. Please try again.",
    );
    await Session.saveCurrentUser(ApiClient.decodeMap(response));
  }

  static Future<ReportingPolicyStatus> reportingStatus(
    PolicyBundle bundle,
  ) async {
    final response = await ApiClient.get(
      '/auth/mobile/policies/status',
    ).timeout(const Duration(seconds: 15));
    ApiClient.throwIfError(
      response,
      fallback: "We couldn't check your reporting consent. Please try again.",
    );
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
      fallback: "We couldn't save your reporting consent. Please try again.",
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
