import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

class StepProgressIndicator extends StatelessWidget {
  const StepProgressIndicator({
    super.key,
    required this.currentStep,
    required this.titles,
    this.completedLabel = 'Completed',
  }) : assert(titles.length > 0),
       assert(currentStep >= 0 && currentStep <= titles.length);

  /// Zero-based active step; titles.length means the flow is complete.
  final int currentStep;
  final List<String> titles;
  final String completedLabel;

  static const _activeColor = Color(0xFF134c8c);
  static const _captionColor = Color(0xFF6B7280);

  @override
  Widget build(BuildContext context) {
    final total = titles.length;
    final caption = currentStep == total
        ? completedLabel
        : 'Step ${currentStep + 1} of $total \u00b7 ${titles[currentStep]}';

    return Semantics(
      label: caption,
      liveRegion: true,
      child: ExcludeSemantics(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: List.generate(total * 2 - 1, (index) {
                if (index.isOdd) {
                  return Expanded(
                    child: Container(
                      height: 2,
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      color: index ~/ 2 < currentStep
                          ? _activeColor
                          : Colors.grey.shade300,
                    ),
                  );
                }

                final step = index ~/ 2;
                final isDone = step < currentStep;
                final isActive = step == currentStep;
                return Container(
                  constraints: const BoxConstraints(
                    minWidth: 26,
                    minHeight: 26,
                  ),
                  padding: const EdgeInsets.all(5),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isActive || isDone
                        ? _activeColor
                        : Colors.grey.shade300,
                  ),
                  child: isDone
                      ? const Icon(
                          LucideIcons.check,
                          size: 14,
                          color: Colors.white,
                        )
                      : Text(
                          '${step + 1}',
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: isActive ? Colors.white : _captionColor,
                          ),
                        ),
                );
              }),
            ),
            const SizedBox(height: 8),
            Text(
              caption,
              style: GoogleFonts.inter(
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
                color: _captionColor,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
