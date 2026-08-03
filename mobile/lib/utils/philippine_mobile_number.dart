import 'package:flutter/services.dart';

const philippineMobilePrefix = '+63';
const philippineMobileHint = '917 123 4567';
const philippineMobileHelper =
    'Enter the 10 digits after +63, starting with 9.';

String _digits(String value) => value.replaceAll(RegExp(r'\D'), '');

String? validatePhilippineMobileInput(String? value) {
  final digits = _digits(value ?? '');

  if (digits.isEmpty) return 'Mobile number is required.';
  if (digits.length != 10) return 'Enter all 10 digits after +63.';
  if (!digits.startsWith('9')) {
    return 'Philippine mobile numbers must start with 9.';
  }
  return null;
}

String toLocalPhilippineMobileNumber(String value) {
  final digits = _digits(value);
  if (!RegExp(r'^9\d{9}$').hasMatch(digits)) {
    throw const FormatException('Invalid Philippine mobile number');
  }
  return '0$digits';
}

String toPhilippineMobileInput(String value) {
  final digits = _digits(value);
  final subscriber = digits.startsWith('63') && digits.length == 12
      ? digits.substring(2)
      : digits.startsWith('0') && digits.length == 11
      ? digits.substring(1)
      : digits;
  return formatPhilippineMobileSubscriber(subscriber);
}

String formatPhilippineMobileSubscriber(String value) {
  var digits = _digits(value);
  if (digits.startsWith('63')) {
    digits = digits.substring(2);
  } else if (digits.startsWith('0')) {
    digits = digits.substring(1);
  }
  final limited = digits.length > 10 ? digits.substring(0, 10) : digits;
  final groups = <String>[];

  if (limited.isNotEmpty) {
    groups.add(limited.substring(0, limited.length < 3 ? limited.length : 3));
  }
  if (limited.length > 3) {
    groups.add(limited.substring(3, limited.length < 6 ? limited.length : 6));
  }
  if (limited.length > 6) {
    groups.add(limited.substring(6));
  }

  return groups.join(' ');
}

class PhilippineMobileInputFormatter extends TextInputFormatter {
  const PhilippineMobileInputFormatter();

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final formatted = formatPhilippineMobileSubscriber(newValue.text);
    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }
}
