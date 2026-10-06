import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

/// Keeps authentication content compact, scrollable, and bounded on tablets.
class AuthScreenLayout extends StatelessWidget {
  final Widget child;
  final VoidCallback onBack;

  const AuthScreenLayout({
    super.key,
    required this.child,
    required this.onBack,
  });

  @override
  Widget build(BuildContext context) {
    const blue = Color(0xFF134C8C);
    const headerHeight = 132.0;
    return Scaffold(
      backgroundColor: blue,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) => SingleChildScrollView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 560),
                child: Column(
                  children: [
                    SizedBox(
                      height: headerHeight,
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                        child: Column(
                          children: [
                            Align(
                              alignment: Alignment.centerLeft,
                              child: TextButton.icon(
                                onPressed: onBack,
                                style: TextButton.styleFrom(
                                  foregroundColor: Colors.white,
                                  minimumSize: const Size(48, 48),
                                ),
                                icon: const Icon(LucideIcons.chevronLeft),
                                label: Text('Back', style: GoogleFonts.inter()),
                              ),
                            ),
                            Expanded(
                              child: Image.asset(
                                'assets/foodsafe_logo.png',
                                fit: BoxFit.contain,
                                semanticLabel: 'FoodSafe',
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    Container(
                      width: double.infinity,
                      constraints: BoxConstraints(
                        minHeight: math.max(
                          0,
                          constraints.maxHeight - headerHeight,
                        ),
                      ),
                      padding: EdgeInsets.all(
                        constraints.maxWidth < 360 ? 16 : 24,
                      ),
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.vertical(
                          top: Radius.circular(24),
                        ),
                      ),
                      child: Theme(
                        data: Theme.of(context).copyWith(
                          elevatedButtonTheme: ElevatedButtonThemeData(
                            style: ElevatedButton.styleFrom(
                              minimumSize: const Size(48, 52),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 14,
                              ),
                            ),
                          ),
                          outlinedButtonTheme: OutlinedButtonThemeData(
                            style: OutlinedButton.styleFrom(
                              minimumSize: const Size(48, 52),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 14,
                              ),
                            ),
                          ),
                        ),
                        child: child,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
