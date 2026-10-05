class SessionProfile {
  final String userId;
  final String username;
  final String phoneNumber;
  final String email;
  final bool emailVerified;

  const SessionProfile({
    required this.userId,
    required this.username,
    required this.phoneNumber,
    required this.email,
    required this.emailVerified,
  });

  static SessionProfile? fromJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    final id = json['_id'] ?? json['id'];
    if (id is! String || id.isEmpty) return null;
    return SessionProfile(
      userId: id,
      username: json['username'] is String ? json['username'] as String : '',
      phoneNumber: json['phoneNumber'] is String
          ? json['phoneNumber'] as String
          : '',
      email: json['email'] is String ? json['email'] as String : '',
      emailVerified: json['emailVerified'] == true,
    );
  }

  // Explicit whitelist. No response spread, nested data, or authentication material.
  Map<String, dynamic> toJson({bool includeUnverifiedEmail = false}) => {
    '_id': userId,
    'id': userId,
    'username': username,
    'phoneNumber': phoneNumber,
    'email': emailVerified || includeUnverifiedEmail ? email : '',
    'emailVerified': emailVerified,
  };
}
