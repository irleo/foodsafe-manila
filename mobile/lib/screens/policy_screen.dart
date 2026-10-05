import 'package:flutter/material.dart';

import '../services/api_client.dart';
import '../services/policy_service.dart';
import '../services/location_service.dart';
import '../services/session.dart';

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
            minimumSize: const Size(48, 48),
            textStyle: TextStyle(
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
  });

  @override
  Widget build(BuildContext context) => Column(
    children: [
      if (showLinks) const PolicyLinks(),
      CheckboxListTile(
        value: termsAccepted,
        onChanged: enabled ? (value) => onTermsChanged(value == true) : null,
        title: const Text('I accept the Terms of Use (required).'),
        controlAffinity: ListTileControlAffinity.leading,
        contentPadding: EdgeInsets.zero,
      ),
      CheckboxListTile(
        value: privacyAcknowledged,
        onChanged: enabled ? (value) => onPrivacyChanged(value == true) : null,
        title: const Text('I acknowledge the Privacy Policy.'),
        subtitle: const Text(
          'Acknowledgement is not consent to every use of your data.',
        ),
        controlAffinity: ListTileControlAffinity.leading,
        contentPadding: EdgeInsets.zero,
      ),
    ],
  );
}

class PolicyScreen extends StatefulWidget {
  final String? type;
  const PolicyScreen({super.key, this.type});

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
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
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
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('Policies could not be loaded.'),
                TextButton(
                  onPressed: () =>
                      setState(() => _future = PolicyService.load()),
                  child: const Text('Retry'),
                ),
              ],
            ),
          );
        }
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final bundle = snapshot.data!;
        final documents = widget.type == null
            ? bundle.documents
            : [bundle.policy(widget.type!)];
        return ListView(
          padding: const EdgeInsets.all(20),
          children: [
            for (final document in documents) ...[
              Semantics(
                header: true,
                child: Text(
                  document.title,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              SelectableText(
                'Version ${document.version} | ${document.status == 'testing'
                    ? 'Private testing'
                    : document.published
                    ? 'Published'
                    : 'Unavailable'}',
              ),
              const SizedBox(height: 12),
              SelectableText(document.text),
              const SizedBox(height: 24),
            ],
            if (widget.type == null) ...[
              SwitchListTile(
                title: const Text('Use device location (optional)'),
                subtitle: const Text(
                  'OS permission is separate from Privacy Policy acknowledgement.',
                ),
                value: PolicyService.locationEnabled,
                onChanged: _saving
                    ? null
                    : (enabled) async {
                        try {
                          if (enabled) {
                            if (!await showLocationDisclosure(context)) return;
                            await LocationService.initializePermission();
                          } else {
                            await PolicyService.setLocationEnabled(false);
                            LocationService.clearCachedLocation();
                          }
                          if (mounted) setState(() {});
                        } catch (error) {
                          if (mounted) {
                            setState(
                              () => _error = ApiClient.safeErrorMessage(error),
                            );
                          }
                        }
                      },
              ),
              if (Session.currentUser != null) ...[
                const Text(
                  'When required policies change, review them before account updates or reporting. Declining keeps public information available.',
                ),
                PolicyChoices(
                  termsAccepted: _terms,
                  privacyAcknowledged: _privacy,
                  enabled: bundle.accountPublished && !_saving,
                  onTermsChanged: (value) => setState(() => _terms = value),
                  onPrivacyChanged: (value) => setState(() => _privacy = value),
                ),
                FilledButton(
                  onPressed:
                      bundle.accountPublished && _terms && _privacy && !_saving
                      ? () => _save(bundle)
                      : null,
                  child: Text(_saving ? 'Saving...' : 'Save acknowledgement'),
                ),
              ],
            ],
            if (_error != null) Text(_error!, semanticsLabel: 'Error: $_error'),
          ],
        );
      },
    ),
  );
}

Future<bool> showLocationDisclosure(BuildContext context) async {
  try {
    final bundle = await PolicyService.load();
    if (!context.mounted) return false;
    final notice = bundle.policy('location');
    bool selected = false;
    final agreed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: const Text('Before using location'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                SelectableText('Version ${notice.version}\n\n${notice.text}'),
                const PolicyLinks(),
                CheckboxListTile(
                  value: selected,
                  onChanged: notice.published
                      ? (value) => setState(() => selected = value == true)
                      : null,
                  title: const Text(
                    'Use device location for location features (optional).',
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Decline'),
            ),
            FilledButton(
              onPressed: notice.published && selected
                  ? () => Navigator.pop(dialogContext, true)
                  : null,
              child: const Text('Continue to device permission'),
            ),
          ],
        ),
      ),
    );
    if (agreed != true) return false;
    await PolicyService.setLocationEnabled(true, version: notice.version);
    return true;
  } catch (error) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            ApiClient.safeErrorMessage(
              error,
              fallback: 'Location disclosure could not be loaded.',
            ),
          ),
        ),
      );
    }
    return false;
  }
}

Future<bool> ensureAccountPolicies(BuildContext context) async {
  if (!await PolicyService.requiresAccountAcknowledgement()) return true;
  if (!context.mounted) return false;
  final accepted = await Navigator.push<bool>(
    context,
    MaterialPageRoute(builder: (_) => const PolicyScreen()),
  );
  return accepted == true;
}

class ReportingDisclosureScreen extends StatefulWidget {
  final Future<void> Function(PolicyBundle, bool) onContinue;
  const ReportingDisclosureScreen({super.key, required this.onContinue});

  @override
  State<ReportingDisclosureScreen> createState() =>
      _ReportingDisclosureScreenState();
}

class _ReportingDisclosureScreenState extends State<ReportingDisclosureScreen> {
  late Future<PolicyBundle> _future;
  bool _acknowledged = false;
  bool _healthConsent = false;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _future = PolicyService.load();
  }

  Future<void> _continue(PolicyBundle bundle) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.onContinue(bundle, _healthConsent);
    } catch (error) {
      if (mounted) setState(() => _error = ApiClient.safeErrorMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Before you report')),
    body: FutureBuilder<PolicyBundle>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return Center(
            child: TextButton(
              onPressed: () => setState(() => _future = PolicyService.load()),
              child: const Text('Could not load disclosures. Retry'),
            ),
          );
        }
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final bundle = snapshot.data!;
        final notice = bundle.policy('reporting');
        return ListView(
          padding: const EdgeInsets.all(20),
          children: [
            SelectableText('Version ${notice.version}\n\n${notice.text}'),
            const PolicyLinks(),
            if (!bundle.reportingPublished)
              const Text('Reporting is unavailable pending policy approval.'),
            CheckboxListTile(
              value: _acknowledged,
              onChanged: bundle.reportingPublished && !_busy
                  ? (value) => setState(() => _acknowledged = value == true)
                  : null,
              title: const Text('I have read the reporting disclosure.'),
            ),
            if (bundle.healthConsentRequired == true)
              CheckboxListTile(
                value: _healthConsent,
                onChanged: bundle.reportingPublished && !_busy
                    ? (value) => setState(() => _healthConsent = value == true)
                    : null,
                title: Text(bundle.healthConsentText),
              ),
            const Text(
              'Reporting is optional. You can leave without submitting health information.',
            ),
            FilledButton(
              onPressed:
                  bundle.reportingPublished &&
                      _acknowledged &&
                      !_busy &&
                      (bundle.healthConsentRequired != true || _healthConsent)
                  ? () => _continue(bundle)
                  : null,
              child: Text(_busy ? 'Checking...' : 'Continue'),
            ),
            if (_error != null) Text(_error!, semanticsLabel: 'Error: $_error'),
          ],
        );
      },
    ),
  );
}
