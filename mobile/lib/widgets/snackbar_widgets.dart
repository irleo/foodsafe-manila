import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class SnackbarWidgets {
  static void show(
    BuildContext context, {
    required String message,
    IconData icon = Icons.info_outline,
    Color bgColor = const Color(0xFF1F2937),
  }) {
    ScaffoldMessenger.of(context).clearSnackBars();

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        margin: EdgeInsets.only(bottom: 30, left: 16, right: 16),
        padding: EdgeInsets.zero,
        backgroundColor: Colors.transparent,
        elevation: 0,
        duration: const Duration(seconds: 3),
        content: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(14),
            boxShadow: const [
              BoxShadow(
                color: Color(0x33000000),
                blurRadius: 16,
                offset: Offset(0, 6),
              ),
            ],
          ),
          child: Row(
            children: [
              Icon(icon, color: Colors.white, size: 22),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  message,
                  style: GoogleFonts.inter(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static void error(BuildContext context, String msg) {
    show(
      context,
      message: msg,
      icon: Icons.error_outline,
      bgColor: const Color(0xFFDC2626),
    );
  }

  static void success(BuildContext context, String msg) {
    show(
      context,
      message: msg,
      icon: Icons.check_circle_outline,
      bgColor: const Color(0xFF16A34A),
    );
  }

  static void info(BuildContext context, String msg) {
    show(
      context,
      message: msg,
      icon: Icons.info_outline,
      bgColor: const Color(0xFF2563EB),
    );
  }
}
