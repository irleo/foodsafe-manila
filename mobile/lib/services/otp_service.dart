import 'dart:async';
import 'dart:math';

class OTPService {
  String? _generatedOTP;
  DateTime? _otpExpiryTime;
  Timer? _timer;

  // Duration for OTP validity
  final Duration otpValidity;

  OTPService({this.otpValidity = const Duration(minutes: 2)});

  /// Generate a new OTP or return existing if not expired
  String generateOTP({bool forceNew = false}) {
    final now = DateTime.now();

    if (!forceNew &&
        _generatedOTP != null &&
        _otpExpiryTime != null &&
        now.isBefore(_otpExpiryTime!)) {
      return _generatedOTP!;
    }

    final rnd = Random();
    _generatedOTP = (rnd.nextInt(9000) + 1000).toString();
    _otpExpiryTime = now.add(otpValidity);

    return _generatedOTP!;
  }

  /// Check if OTP is valid
  bool validateOTP(String input) {
    final now = DateTime.now();
    if (_generatedOTP == null || _otpExpiryTime == null) return false;
    if (now.isAfter(_otpExpiryTime!)) return false;
    return input == _generatedOTP;
  }

  /// Check if current OTP is expired
  bool get isExpired {
    final now = DateTime.now();
    return _otpExpiryTime == null || now.isAfter(_otpExpiryTime!);
  }

  /// Optional: expose expiry time if you want
  DateTime? get expiryTime => _otpExpiryTime;

  void startResendTimer({
    int startSeconds = 30,
    required void Function(int remainingSeconds) onTick,
    void Function()? onCompleted,
  }) {
    _timer?.cancel();

    int remainingSeconds = startSeconds;
    onTick(remainingSeconds);

    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      remainingSeconds--;
      if (remainingSeconds <= 0) {
        timer.cancel();
        _timer = null;
        onCompleted?.call();
      } else {
        onTick(remainingSeconds);
      }
    });
  }

  void stopResendTimer() {
    _timer?.cancel();
    _timer = null;
  }
}
