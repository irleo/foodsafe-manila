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
        margin: EdgeInsets.only(
          bottom: 30,
          left: 16,
          right: 16,
        ),
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

  static void showTopNotification(BuildContext context, String otp) {
    final overlay = Overlay.of(context);

    late OverlayEntry entry;

    entry = OverlayEntry(
      builder: (context) {
        final topPadding = MediaQuery.of(context).padding.top;

        return Positioned(
          top: topPadding + 12,
          left: 12,
          right: 12,
          child: Material(
            color: Colors.transparent,
            child: _TopNotificationCard(
              otp: otp,
              onDismiss: () {
                entry.remove();
              },
            ),
          ),
        );
      },
    );

    overlay.insert(entry);

    // Auto remove after 4 seconds
    Future.delayed(const Duration(seconds: 4), () {
      if (entry.mounted) {
        entry.remove();
      }
    });
  }
}

class _TopNotificationCard extends StatefulWidget {
  final String otp;
  final VoidCallback onDismiss;

  const _TopNotificationCard({
    required this.otp,
    required this.onDismiss,
  });

  @override
  State<_TopNotificationCard> createState() => _TopNotificationCardState();
}

class _TopNotificationCardState extends State<_TopNotificationCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<Offset> _slide;

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );

    _slide = Tween(
      begin: const Offset(0, -1),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOut,
    ));

    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SlideTransition(
      position: _slide,
      child: Material(
        elevation: 12,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(
                Icons.sms_outlined,
                color: Color(0xFF2563EB),
                size: 28,
              ),
              const SizedBox(width: 12),

              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "Message Received",
                      style: GoogleFonts.inter(
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      "Your OTP code is ${widget.otp}",
                      style: GoogleFonts.inter(fontSize: 13),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}