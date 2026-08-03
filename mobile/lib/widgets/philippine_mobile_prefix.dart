import 'package:flutter/material.dart';

import '../utils/philippine_mobile_number.dart';

class PhilippineMobilePrefix extends StatelessWidget {
  final Color color;

  const PhilippineMobilePrefix({
    super.key,
    this.color = const Color(0xFF6B7280),
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 88,
      child: Padding(
        padding: const EdgeInsets.only(left: 12),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.phone_outlined, color: color, size: 21),
            const SizedBox(width: 8),
            Text(
              philippineMobilePrefix,
              style: TextStyle(color: color, fontWeight: FontWeight.w600),
            ),
          ],
        ),
      ),
    );
  }
}
