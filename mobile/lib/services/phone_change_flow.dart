class PhoneChangeFlow {
  final String id;
  final String maskedPhone;
  final int expiresInSeconds;
  final int retryAfterSeconds;

  const PhoneChangeFlow({
    required this.id,
    required this.maskedPhone,
    required this.expiresInSeconds,
    required this.retryAfterSeconds,
  });

  factory PhoneChangeFlow.fromJson(Map<String, dynamic> json) {
    final id = json['flowId'];
    final masked = json['maskedPhone'];
    final expires = json['expiresInSeconds'];
    final retry = json['retryAfterSeconds'];
    if (id is! String ||
        !RegExp(r'^[a-f0-9]{64}$').hasMatch(id) ||
        masked is! String ||
        masked.isEmpty ||
        expires is! int ||
        expires <= 0 ||
        retry is! int ||
        retry < 0) {
      throw const FormatException('Invalid phone verification response');
    }
    return PhoneChangeFlow(
      id: id,
      maskedPhone: masked,
      expiresInSeconds: expires,
      retryAfterSeconds: retry,
    );
  }
}
