import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:foodsafe_manila/services/api_client.dart';

int _seconds(
  Map<String, dynamic> data,
  String key,
  int fallback, {
  bool allowZero = false,
}) {
  final value = data[key] ?? fallback;
  if (value is! num ||
      !value.isFinite ||
      value != value.roundToDouble() ||
      value < (allowZero ? 0 : 1) ||
      value > 86400) {
    throw ApiException(
      502,
      'Invalid verification response. Please retry.',
      code: 'INVALID_RESPONSE',
    );
  }
  return value.toInt();
}

class OtpSendResult {
  final int expiresInSeconds;
  final int retryAfterSeconds;
  OtpSendResult.fromJson(Map<String, dynamic> data)
    : expiresInSeconds = _seconds(data, 'expiresInSeconds', 300),
      retryAfterSeconds = _seconds(
        data,
        'retryAfterSeconds',
        60,
        allowZero: true,
      );
}

class EmailRecoverySendResult extends OtpSendResult {
  final String flowId;
  EmailRecoverySendResult.fromJson(super.data)
    : flowId = data['flowId'] is String ? data['flowId'] as String : '',
      super.fromJson() {
    if (!RegExp(r'^[a-f0-9]{64}$').hasMatch(flowId)) {
      throw ApiException(
        502,
        'Please restart email recovery and request a new code.',
        code: 'INVALID_RESPONSE',
      );
    }
  }
}

class OtpVerificationResult {
  final String token;
  final int expiresInSeconds;
  OtpVerificationResult.fromJson(Map<String, dynamic> data)
    : token = data['verificationToken'] is String
          ? data['verificationToken'] as String
          : '',
      expiresInSeconds = _seconds(data, 'expiresInSeconds', 600) {
    if (token.isEmpty) {
      throw ApiException(
        502,
        'Verification proof is missing. Please retry.',
        code: 'INVALID_RESPONSE',
      );
    }
  }
}

// Shared deadline/proof state for signup and recovery; never persisted locally.
class OtpFlow extends ChangeNotifier {
  final DateTime Function() _clock;
  OtpFlow({DateTime Function()? clock}) : _clock = clock ?? DateTime.now;
  Timer? _timer;
  DateTime? _resendAt;
  DateTime? _expiresAt;
  DateTime? _proofExpiresAt;
  String? _token;
  int get retryAfterSeconds {
    final remaining =
        ((_resendAt?.difference(_clock()).inMilliseconds ?? 0) / 1000).ceil();
    return remaining > 0 ? remaining : 0;
  }

  bool get expired =>
      _expiresAt != null && !_clock().isBefore(_proofExpiresAt ?? _expiresAt!);
  String? get verificationToken => expired ? null : _token;

  void sent(OtpSendResult result) {
    _token = null;
    _proofExpiresAt = null;
    _expiresAt = _clock().add(Duration(seconds: result.expiresInSeconds));
    cooldown(result.retryAfterSeconds);
  }

  void verified(OtpVerificationResult result) {
    _token = result.token;
    _proofExpiresAt = _clock().add(Duration(seconds: result.expiresInSeconds));
    _tick();
  }

  void cooldown(int seconds) {
    final next = _clock().add(Duration(seconds: seconds));
    if (_resendAt == null || next.isAfter(_resendAt!)) _resendAt = next;
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
    _tick();
  }

  void invalidate() {
    _token = null;
    _proofExpiresAt = null;
    _expiresAt = _clock();
    _tick();
  }

  void clear() {
    _timer?.cancel();
    _resendAt = _expiresAt = _proofExpiresAt = null;
    _token = null;
    notifyListeners();
  }

  void _tick() {
    if (retryAfterSeconds == 0 && expired) _timer?.cancel();
    notifyListeners();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}
