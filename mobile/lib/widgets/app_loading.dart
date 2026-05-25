import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Unified loading indicator matching the app theme.
class AppLoadingIndicator extends StatelessWidget {
  final double size;
  final double strokeWidth;
  final Color? color;

  const AppLoadingIndicator({
    super.key,
    this.size = 32,
    this.strokeWidth = 2.4,
    this.color,
  });

  static const Color primaryColor = Color(0xFF2563EB);

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CircularProgressIndicator(
        strokeWidth: strokeWidth,
        color: color ?? primaryColor,
      ),
    );
  }
}

/// Full-area centered loading with optional message.
class AppLoadingCenter extends StatelessWidget {
  final String? message;
  final EdgeInsets padding;

  const AppLoadingCenter({
    super.key,
    this.message,
    this.padding = const EdgeInsets.all(24),
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: padding,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const AppLoadingIndicator(),
            if (message != null) ...[
              const SizedBox(height: 12),
              Text(
                message!,
                style: GoogleFonts.inter(
                  fontSize: 13,
                  color: const Color(0xFF6B7280),
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Inline loading for cards and sections.
class AppLoadingCard extends StatelessWidget {
  final EdgeInsets padding;

  const AppLoadingCard({
    super.key,
    this.padding = const EdgeInsets.all(24),
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: const Center(child: AppLoadingIndicator()),
    );
  }
}

/// Semi-transparent overlay for content areas (e.g. map).
class AppLoadingOverlay extends StatelessWidget {
  final String? message;

  const AppLoadingOverlay({super.key, this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white.withValues(alpha: 0.72),
      child: AppLoadingCenter(message: message),
    );
  }
}
