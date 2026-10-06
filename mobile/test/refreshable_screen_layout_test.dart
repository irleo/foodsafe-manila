import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:foodsafe_manila/layout/refreshable_screen_layout.dart';

void main() {
  for (final contentHeight in [80.0, 1200.0]) {
    testWidgets('pull to refresh works with $contentHeight pixel content', (
      tester,
    ) async {
      var refreshCount = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: RefreshableScreenLayout(
            onRefresh: () async => refreshCount++,
            child: SizedBox(height: contentHeight),
          ),
        ),
      );
      await tester.drag(find.byType(SingleChildScrollView), const Offset(0, 350));
      await tester.pumpAndSettle();
      expect(refreshCount, 1);
      expect(tester.takeException(), isNull);
    });
  }
}
