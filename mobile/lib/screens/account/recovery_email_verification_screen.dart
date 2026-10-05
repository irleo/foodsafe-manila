import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:foodsafe_manila/services/api_client.dart';
import 'package:foodsafe_manila/services/api_service.dart';

class RecoveryEmailVerificationScreen extends StatefulWidget {
  final String email;
  const RecoveryEmailVerificationScreen({super.key, required this.email});

  @override
  State<RecoveryEmailVerificationScreen> createState() =>
      _RecoveryEmailVerificationScreenState();
}

class _RecoveryEmailVerificationScreenState
    extends State<RecoveryEmailVerificationScreen> {
  final _code = TextEditingController();
  Timer? _timer;
  int _cooldown = 0;
  bool _busy = false;
  bool _sent = false;
  String? _error;

  @override
  void dispose() {
    _timer?.cancel();
    _code.dispose();
    super.dispose();
  }

  void _startCooldown() {
    _timer?.cancel();
    setState(() => _cooldown = 60);
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      setState(() => _cooldown--);
      if (_cooldown <= 0) timer.cancel();
    });
  }

  Future<void> _send() async {
    if (_busy || _cooldown > 0) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ApiService.sendRecoveryEmailVerification(widget.email);
      if (!mounted) return;
      setState(() => _sent = true);
      _code.clear();
      _startCooldown();
    } catch (error) {
      if (mounted) {
        setState(() => _error = ApiClient.safeErrorMessage(error));
        if (error is ApiException && error.statusCode == 429) _startCooldown();
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _verify() async {
    if (_busy || _code.text.length != 6) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ApiService.verifyRecoveryEmail(
        email: widget.email,
        otp: _code.text,
      );
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) setState(() => _error = ApiClient.safeErrorMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Verify recovery email')),
    body: ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Text(widget.email, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 12),
        const Text('This address cannot recover your account until verified.'),
        const SizedBox(height: 20),
        if (_sent) ...[
          TextField(
            controller: _code,
            keyboardType: TextInputType.number,
            autofillHints: const [AutofillHints.oneTimeCode],
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(6),
            ],
            decoration: const InputDecoration(labelText: 'Verification code'),
            onChanged: (_) => setState(() {}),
            enabled: !_busy,
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: !_busy && _code.text.length == 6 ? _verify : null,
            child: const Text('Verify email'),
          ),
        ],
        TextButton(
          onPressed: _busy || _cooldown > 0 ? null : _send,
          child: Text(
            _cooldown > 0
                ? 'Resend in $_cooldown s'
                : _sent
                ? 'Resend code'
                : 'Send verification code',
          ),
        ),
        if (_busy) const Center(child: CircularProgressIndicator()),
        if (_error != null) Text(_error!, semanticsLabel: 'Error: $_error'),
      ],
    ),
  );
}
