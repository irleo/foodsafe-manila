import 'package:flutter/material.dart';

/// Shared scrolling and pull-to-refresh shell for dashboard content screens.
class RefreshableScreenLayout extends StatelessWidget {
  final Widget child;
  final Future<void> Function() onRefresh;
  final Color refreshColor;
  final bool safeAreaBottom;

  const RefreshableScreenLayout({
    super.key,
    required this.child,
    required this.onRefresh,
    this.refreshColor = const Color(0xFF134C8C),
    this.safeAreaBottom = true,
  });

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFF9FAFB),
    body: SafeArea(
      bottom: safeAreaBottom,
      child: RefreshIndicator(
        onRefresh: onRefresh,
        color: refreshColor,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: SizedBox(width: double.infinity, child: child),
        ),
      ),
    ),
  );
}
