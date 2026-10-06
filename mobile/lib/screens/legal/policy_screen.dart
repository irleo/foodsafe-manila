import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:foodsafe_manila/services/api_client.dart';
import 'package:foodsafe_manila/services/policy_service.dart';
import 'package:foodsafe_manila/services/session.dart';

class PolicyLinks extends StatelessWidget {
  final bool compact;
  const PolicyLinks({super.key, this.compact = false});

  @override
  Widget build(BuildContext context) => Wrap(
    alignment: WrapAlignment.center,
    spacing: 8,
    children: [
      for (final entry in {
        'privacy': 'Privacy Policy',
        'terms': 'Terms of Use',
      }.entries)
        TextButton(
          style: TextButton.styleFrom(
            foregroundColor: const Color(0xFF134C8C),
            minimumSize: const Size(48, 48),
            textStyle: GoogleFonts.inter(
              fontSize: compact ? 12 : 14,
              decoration: TextDecoration.underline,
            ),
          ),
          onPressed: () => Navigator.push(
            context,
            MaterialPageRoute<void>(
              builder: (_) => PolicyScreen(type: entry.key),
            ),
          ),
          child: Text(entry.value),
        ),
    ],
  );
}

class PolicyChoices extends StatelessWidget {
  final bool termsAccepted;
  final bool privacyAcknowledged;
  final bool enabled;
  final bool showLinks;
  final bool inlineLinks;
  final ValueChanged<bool> onTermsChanged;
  final ValueChanged<bool> onPrivacyChanged;

  const PolicyChoices({
    super.key,
    required this.termsAccepted,
    required this.privacyAcknowledged,
    required this.onTermsChanged,
    required this.onPrivacyChanged,
    this.enabled = true,
    this.showLinks = true,
    this.inlineLinks = false,
  });

  @override
  Widget build(BuildContext context) => Column(
    children: [
      if (showLinks) const PolicyLinks(),
      if (inlineLinks) ...[
        _LinkedPolicyChoice(
          value: termsAccepted,
          enabled: enabled,
          prefix: 'I accept the',
          title: 'Terms of Use',
          type: 'terms',
          suffix: '(required).',
          onChanged: onTermsChanged,
        ),
        _LinkedPolicyChoice(
          value: privacyAcknowledged,
          enabled: enabled,
          prefix: 'I acknowledge the',
          title: 'Privacy Policy',
          type: 'privacy',
          subtitle: 'Acknowledgement is not consent to every use of your data.',
          onChanged: onPrivacyChanged,
        ),
      ] else ...[
        CheckboxListTile(
          value: termsAccepted,
          onChanged: enabled ? (value) => onTermsChanged(value == true) : null,
          title: const Text('I accept the Terms of Use (required).'),
          controlAffinity: ListTileControlAffinity.leading,
          contentPadding: EdgeInsets.zero,
        ),
        CheckboxListTile(
          value: privacyAcknowledged,
          onChanged: enabled
              ? (value) => onPrivacyChanged(value == true)
              : null,
          title: const Text('I acknowledge the Privacy Policy.'),
          subtitle: const Text(
            'Acknowledgement is not consent to every use of your data.',
          ),
          controlAffinity: ListTileControlAffinity.leading,
          contentPadding: EdgeInsets.zero,
        ),
      ],
    ],
  );
}

/// Keep the document link separate from the checkbox's acceptance gesture.
class _LinkedPolicyChoice extends StatelessWidget {
  final bool value;
  final bool enabled;
  final String prefix;
  final String title;
  final String type;
  final String? suffix;
  final String? subtitle;
  final ValueChanged<bool> onChanged;

  const _LinkedPolicyChoice({
    required this.value,
    required this.enabled,
    required this.prefix,
    required this.title,
    required this.type,
    required this.onChanged,
    this.suffix,
    this.subtitle,
  });

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Semantics(
        label: '$prefix $title ${suffix ?? ''}'.trim(),
        child: Checkbox(
          value: value,
          activeColor: const Color(0xFF134C8C),
          onChanged: enabled ? (checked) => onChanged(checked == true) : null,
        ),
      ),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 4,
              children: [
                Text(
                  prefix,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    color: const Color(0xFF374151),
                  ),
                ),
                TextButton(
                  style: TextButton.styleFrom(
                    foregroundColor: const Color(0xFF134C8C),
                    minimumSize: const Size(48, 48),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 2,
                      vertical: 12,
                    ),
                    textStyle: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      decoration: TextDecoration.underline,
                    ),
                  ),
                  onPressed: () => Navigator.push<void>(
                    context,
                    MaterialPageRoute<void>(
                      builder: (_) => PolicyScreen(type: type),
                    ),
                  ),
                  child: Text(title),
                ),
                if (suffix != null)
                  Text(
                    suffix!,
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      color: const Color(0xFF374151),
                    ),
                  ),
              ],
            ),
            if (subtitle != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(
                  subtitle!,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    height: 1.5,
                    color: const Color(0xFF6B7280),
                  ),
                ),
              ),
          ],
        ),
      ),
    ],
  );
}

class PolicyScreen extends StatefulWidget {
  final String? type;
  final bool requireAcknowledgement;
  const PolicyScreen({
    super.key,
    this.type,
    this.requireAcknowledgement = false,
  });

  @override
  State<PolicyScreen> createState() => _PolicyScreenState();
}

class _PolicyScreenState extends State<PolicyScreen> {
  late Future<PolicyBundle> _future;
  bool _terms = false;
  bool _privacy = false;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _future = PolicyService.load();
  }

  Future<void> _save(PolicyBundle bundle) async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await PolicyService.acceptAccountPolicies(bundle);
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = ApiClient.safeErrorMessage(error);
          if (error is ApiException &&
              error.code == 'POLICY_ACCEPTANCE_REQUIRED') {
            _terms = false;
            _privacy = false;
            _future = PolicyService.load();
          }
        });
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => Theme(
    data: Theme.of(context).copyWith(
      colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF134C8C)),
      textTheme: GoogleFonts.interTextTheme(Theme.of(context).textTheme),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: const Color(0xFF134C8C),
          foregroundColor: Colors.white,
          minimumSize: const Size(48, 52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      ),
    ),
    child: Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: const Color(0xFF134C8C),
        foregroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        titleTextStyle: GoogleFonts.inter(
          fontSize: 17,
          fontWeight: FontWeight.w600,
          color: Colors.white,
        ),
        title: Text(
          widget.type == null
              ? 'Privacy and Terms'
              : widget.type == 'terms'
              ? 'Terms of Use'
              : widget.type == 'privacy'
              ? 'Privacy Policy'
              : 'Disclosure',
        ),
      ),
      body: FutureBuilder<PolicyBundle>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.description_outlined,
                      size: 40,
                      color: Color(0xFF134C8C),
                    ),
                    const SizedBox(height: 16),
                    const Text('Policies could not be loaded.'),
                    TextButton(
                      onPressed: () =>
                          setState(() => _future = PolicyService.load()),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            );
          }
          if (!snapshot.hasData) {
            return const Center(
              child: CircularProgressIndicator(color: Color(0xFF134C8C)),
            );
          }
          final bundle = snapshot.data!;
          final documents = widget.type == null
              ? bundle.documents
              : [bundle.policy(widget.type!)];
          return SafeArea(
            top: false,
            child: Align(
              alignment: Alignment.topCenter,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 760),
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
                  children: [
                    for (final document in documents)
                      _PolicyDocumentView(document: document),
                    if (widget.type == null) ...[
                      if (widget.requireAcknowledgement &&
                          Session.currentUser != null) ...[
                        const Text(
                          'When required policies change, review them before account updates or reporting. Declining keeps public information available.',
                        ),
                        PolicyChoices(
                          showLinks: false,
                          termsAccepted: _terms,
                          privacyAcknowledged: _privacy,
                          enabled: bundle.accountPublished && !_saving,
                          onTermsChanged: (value) =>
                              setState(() => _terms = value),
                          onPrivacyChanged: (value) =>
                              setState(() => _privacy = value),
                        ),
                        FilledButton(
                          onPressed:
                              bundle.accountPublished &&
                                  _terms &&
                                  _privacy &&
                                  !_saving
                              ? () => _save(bundle)
                              : null,
                          child: Text(
                            _saving ? 'Saving...' : 'Save acknowledgement',
                          ),
                        ),
                      ],
                    ],
                    if (_error != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 16),
                        child: Text(
                          _error!,
                          semanticsLabel: 'Error: $_error',
                          style: const TextStyle(color: Color(0xFFB91C1C)),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    ),
  );
}

/// Presents policy text without changing its wording or paragraph order.
class _PolicyDocumentView extends StatelessWidget {
  final PolicyDocument document;

  const _PolicyDocumentView({required this.document});

  @override
  Widget build(BuildContext context) {
    final paragraphs = document.displayText.trim().split(RegExp(r'\n\s*\n'));
    final status = document.status == 'testing'
        ? 'Private testing'
        : document.published
        ? 'Published'
        : 'Unavailable';
    final headingPattern = RegExp(r'^\d+\.\s+[^\n]+$');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF134C8C), Color(0xFF1767AB)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(24),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(
                  document.type == 'privacy'
                      ? Icons.shield_outlined
                      : Icons.description_outlined,
                  color: Colors.white,
                  size: 28,
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'FOODSAFE MANILA',
                style: GoogleFonts.inter(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 1.6,
                  color: Colors.white70,
                ),
              ),
              const SizedBox(height: 8),
              Semantics(
                header: true,
                child: Text(
                  document.title,
                  style: GoogleFonts.inter(
                    fontSize: 28,
                    fontWeight: FontWeight.w700,
                    height: 1.2,
                    color: Colors.white,
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final label in [status, 'Version ${document.version}'])
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.12),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.2),
                        ),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: SelectableText(
                        label,
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          color: Colors.white,
                          height: 1.4,
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFE5E7EB)),
          ),
          child: SelectionArea(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (int index = 0; index < paragraphs.length; index++) ...[
                  if (headingPattern.hasMatch(paragraphs[index])) ...[
                    const Padding(
                      padding: EdgeInsets.only(top: 8, bottom: 20),
                      child: Divider(height: 1, color: Color(0xFFF0F2F5)),
                    ),
                    Semantics(
                      header: true,
                      child: Text(
                        paragraphs[index],
                        style: GoogleFonts.inter(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          height: 1.5,
                          color: const Color(0xFF134C8C),
                        ),
                      ),
                    ),
                  ] else
                    Text(
                      paragraphs[index].replaceAll(
                        RegExp(r'(?<!\n)\n(?!\n)'),
                        ' ',
                      ),
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        height: 1.8,
                        color: const Color(0xFF4B5563),
                        fontWeight: index == 0
                            ? FontWeight.w600
                            : FontWeight.w400,
                      ),
                    ),
                  if (index < paragraphs.length - 1) const SizedBox(height: 16),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),
      ],
    );
  }
}

Future<bool> ensureAccountPolicies(BuildContext context) async {
  if (!await PolicyService.requiresAccountAcknowledgement()) return true;
  if (!context.mounted) return false;
  final accepted = await Navigator.push<bool>(
    context,
    MaterialPageRoute(
      builder: (_) => const PolicyScreen(requireAcknowledgement: true),
    ),
  );
  return accepted == true;
}

class ReportingDisclosureScreen extends StatefulWidget {
  final Future<void> Function(PolicyBundle, bool, bool) onContinue;
  const ReportingDisclosureScreen({super.key, required this.onContinue});

  @override
  State<ReportingDisclosureScreen> createState() =>
      _ReportingDisclosureScreenState();
}

class _ReportingDisclosureScreenState extends State<ReportingDisclosureScreen> {
  late Future<_ReportingReview> _future;
  bool _acknowledged = false;
  bool _termsAccepted = false;
  bool _privacyAcknowledged = false;
  bool _healthConsent = false;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _future = _loadReview();
  }

  Future<_ReportingReview> _loadReview() async {
    try {
      final bundle = await PolicyService.load();
      final required =
          Session.currentUser == null ||
          await PolicyService.requiresAccountAcknowledgement();
      return _ReportingReview(bundle, required);
    } catch (error, stack) {
      Error.throwWithStackTrace(error, stack);
    }
  }

  Future<void> _continue(_ReportingReview review) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.onContinue(
        review.bundle,
        _healthConsent,
        review.accountAcknowledgementRequired,
      );
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = ApiClient.safeErrorMessage(error);
          if (error is ApiException &&
              (error.code == 'POLICY_ACCEPTANCE_REQUIRED' ||
                  error.code == 'POLICY_REACCEPTANCE_REQUIRED' ||
                  error.code == 'REPORT_DISCLOSURE_REQUIRED')) {
            _termsAccepted = false;
            _privacyAcknowledged = false;
            _acknowledged = false;
            _healthConsent = false;
            _future = _loadReview();
          }
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Theme(
    data: Theme.of(context).copyWith(
      colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF134C8C)),
      textTheme: GoogleFonts.interTextTheme(Theme.of(context).textTheme),
    ),
    child: Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        title: Text(
          'Before you report',
          style: GoogleFonts.inter(
            fontSize: 18,
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
        backgroundColor: const Color(0xFF134C8C),
        foregroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
      ),
      body: FutureBuilder<_ReportingReview>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return Center(
              child: TextButton(
                onPressed: () => setState(() => _future = _loadReview()),
                child: const Text('Could not load disclosures. Retry'),
              ),
            );
          }
          if (snapshot.connectionState != ConnectionState.done ||
              !snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final review = snapshot.data!;
          final bundle = review.bundle;
          final enabled = bundle.reportingPublished && !_busy;
          return SafeArea(
            top: false,
            child: Align(
              alignment: Alignment.topCenter,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 760),
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
                  children: [
                    Text(
                      'Review once, then start your report',
                      style: GoogleFonts.inter(
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF111827),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'All notices and choices are below. Open each section to read the full details.',
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        height: 1.6,
                        color: const Color(0xFF4B5563),
                      ),
                    ),
                    const SizedBox(height: 20),
                    for (final type in [
                      'terms',
                      'privacy',
                      'reporting',
                      'location',
                    ])
                      _ReportingNotice(document: bundle.policy(type)),
                    if (!bundle.reportingPublished)
                      const Text(
                        'Reporting is unavailable pending policy approval.',
                      ),
                    const SizedBox(height: 8),
                    if (review.accountAcknowledgementRequired)
                      PolicyChoices(
                        showLinks: false,
                        termsAccepted: _termsAccepted,
                        privacyAcknowledged: _privacyAcknowledged,
                        enabled: enabled,
                        onTermsChanged: (value) =>
                            setState(() => _termsAccepted = value),
                        onPrivacyChanged: (value) =>
                            setState(() => _privacyAcknowledged = value),
                      )
                    else
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 12),
                        child: Text(
                          'Your Terms of Use acceptance and Privacy Policy acknowledgement are up to date.',
                        ),
                      ),
                    CheckboxListTile(
                      value: _acknowledged,
                      onChanged: enabled
                          ? (value) =>
                                setState(() => _acknowledged = value == true)
                          : null,
                      title: const Text(
                        'I have read the reporting and location disclosures.',
                      ),
                      controlAffinity: ListTileControlAffinity.leading,
                      contentPadding: EdgeInsets.zero,
                    ),
                    if (bundle.healthConsentRequired == true)
                      CheckboxListTile(
                        value: _healthConsent,
                        onChanged: enabled
                            ? (value) =>
                                  setState(() => _healthConsent = value == true)
                            : null,
                        title: Text(bundle.healthConsentText),
                        controlAffinity: ListTileControlAffinity.leading,
                        contentPadding: EdgeInsets.zero,
                      ),
                    const SizedBox(height: 16),
                    const Text(
                      'Reporting is optional. You can leave without submitting health information.',
                    ),
                    const SizedBox(height: 20),
                    FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF134C8C),
                        foregroundColor: Colors.white,
                        minimumSize: const Size(48, 52),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      onPressed:
                          bundle.reportingPublished &&
                              (!review.accountAcknowledgementRequired ||
                                  (_termsAccepted && _privacyAcknowledged)) &&
                              _acknowledged &&
                              !_busy &&
                              (bundle.healthConsentRequired != true ||
                                  _healthConsent)
                          ? () => _continue(review)
                          : null,
                      child: Text(_busy ? 'Checking...' : 'Continue to report'),
                    ),
                    if (_error != null)
                      Text(_error!, semanticsLabel: 'Error: $_error'),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    ),
  );
}

class _ReportingReview {
  final PolicyBundle bundle;
  final bool accountAcknowledgementRequired;

  const _ReportingReview(this.bundle, this.accountAcknowledgementRequired);
}

/// Full notices remain on the confirmation page rather than opening more routes.
class _ReportingNotice extends StatelessWidget {
  final PolicyDocument document;

  const _ReportingNotice({required this.document});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: ExpansionTile(
        key: PageStorageKey<String>(
          'report-notice-${document.type}-${document.version}',
        ),
        tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        shape: const Border(),
        collapsedShape: const Border(),
        iconColor: const Color(0xFF134C8C),
        leading: Icon(
          document.type == 'privacy'
              ? Icons.shield_outlined
              : Icons.description_outlined,
          color: const Color(0xFF134C8C),
        ),
        title: Text(
          document.title,
          style: GoogleFonts.inter(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            color: const Color(0xFF134C8C),
          ),
        ),
        subtitle: Text(
          'Version ${document.version}',
          style: GoogleFonts.inter(
            fontSize: 12,
            color: const Color(0xFF6B7280),
          ),
        ),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
            child: SelectableText(
              key: PageStorageKey<String>(
                'report-text-${document.type}-${document.version}',
              ),
              document.displayText,
              style: GoogleFonts.inter(
                fontSize: 14,
                height: 1.7,
                color: const Color(0xFF4B5563),
              ),
            ),
          ),
        ],
      ),
    ),
  );
}
