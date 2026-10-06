String normalizeRecoveryEmail(String? value) =>
    (value ?? '').trim().toLowerCase();

String? validateRecoveryEmail(String? value, {bool required = false}) {
  final email = normalizeRecoveryEmail(value);
  if (email.isEmpty) return required ? 'Email is required.' : null;
  final pattern = RegExp(
    r"^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$",
  );
  if (email.length > 254 ||
      email.split('@').first.length > 64 ||
      !pattern.hasMatch(email) ||
      email.startsWith('.') ||
      email.contains('..') ||
      email.contains('.@')) {
    return 'Enter a valid email address.';
  }
  return null;
}
