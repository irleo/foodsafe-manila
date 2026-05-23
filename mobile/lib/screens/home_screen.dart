import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/session.dart';
import '../widgets/home_widgets.dart';

class HomeScreen extends StatefulWidget {
  final VoidCallback onProfileTap;
  const HomeScreen({super.key, required this.onProfileTap});

  @override
  State<HomeScreen> createState() => HomeScreenState();
}

class HomeScreenState extends State<HomeScreen> {
  final user = Session.currentUser;
  Map<String, dynamic>? dashboardData;
  bool isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadDashboard();
  }

  Future<void> refreshData() => _loadDashboard();

  Future<void> _loadDashboard() async {
    setState(() => isLoading = true);
    final data = await ApiService.getDashboard();
    if (!mounted) return;
    setState(() {
      dashboardData = data;
      isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      
      body: SafeArea(
        top: true,
        child: SingleChildScrollView(
          padding: const EdgeInsets.only(bottom: 24),
          child: Column(
            children: [
              Header(
                onTap: widget.onProfileTap,
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Transform.translate(
                  offset: const Offset(0, -20),
                  child: Column(
                    children: [
                      DashboardSummaryCard(
                        data: dashboardData,
                        isLoading: isLoading,
                      ),
                      const SizedBox(height: 14),
                      CurrentRiskCard(
                        data: dashboardData,
                        isLoading: isLoading,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
