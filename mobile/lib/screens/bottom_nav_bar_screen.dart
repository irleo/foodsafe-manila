import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:foodsafe_manila/screens/alerts_screen.dart';
import 'package:foodsafe_manila/screens/analytics_screen.dart';
import 'package:foodsafe_manila/screens/report_history_screen.dart';
import 'package:foodsafe_manila/screens/report_form_screen.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../screens/home_screen.dart';
import '../screens/map_screen.dart';
import '../services/api_client.dart';
import '../services/risk_alert_service.dart';
import '../services/session.dart';
import 'personal_info_screen.dart';

class BottomNavBarScreen extends StatefulWidget {
  const BottomNavBarScreen({super.key});

  @override
  State<BottomNavBarScreen> createState() => _BottomNavBarScreenState();
}

class _BottomNavBarScreenState extends State<BottomNavBarScreen>
    with WidgetsBindingObserver {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  final GlobalKey<HomeScreenState> _homeKey = GlobalKey<HomeScreenState>();
  final GlobalKey<MapScreenState> _mapKey = GlobalKey<MapScreenState>();
  final GlobalKey<AnalyticsScreenState> _analyticsKey =
      GlobalKey<AnalyticsScreenState>();
  final GlobalKey<AlertsScreenState> _alertsKey = GlobalKey<AlertsScreenState>();

  int _selectedIndex = 0;
  final PageController _pageController = PageController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    RiskAlertService.instance.startMonitoring();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    RiskAlertService.instance.stopMonitoring();
    _pageController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _onAppResumed();
    }
  }

  Future<void> _onAppResumed() async {
    final ok = await ApiClient.refreshSessionOnResume();
    if (!mounted) return;
    if (!ok) {
      Navigator.pushReplacementNamed(context, '/login');
      return;
    }
    _refreshCurrentTab();
  }

  void _refreshCurrentTab() {
    switch (_selectedIndex) {
      case 0:
        _homeKey.currentState?.refreshData();
        break;
      case 1:
        _mapKey.currentState?.refreshData();
        break;
      case 2:
        _analyticsKey.currentState?.refreshData();
        break;
      case 3:
        _alertsKey.currentState?.refreshData();
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = Session.currentUser;
    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: Colors.white,
      endDrawer: Drawer(
        backgroundColor: const Color(0xFFF9FAFB),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.horizontal(
            left: Radius.circular(20), // for right drawer
          ),
        ),
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF3B82F6), Color(0xFF2563EB)],
                  ),
                ),
                child: Container(
                  padding: EdgeInsets.all(20),
                  child: Row(
                    children: [
                      Container(
                        width: 64,
                        height: 64,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white,
                        ),
                        child: Center(
                          child: Text(
                            user?['username'] != null
                                ? user!['username'][0].toUpperCase()
                                : '',
                            style: GoogleFonts.inter(
                              color: Color(0xFF3B82F6),
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              user?['username'] ?? 'Juan Dela Cruz',
                              style: GoogleFonts.inter(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                            Text(
                              formatPhone(user?['phone_number']),
                              style: GoogleFonts.inter(
                                fontSize: 14,
                                color: Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              _buildMenuTile(
                icon: LucideIcons.user,
                gradientColors: [Color(0xFF3B82F6), Color(0xFF2563EB)],
                title: "Personal Information",
                subtitle: "Update your account details",
                page: const PersonalInfoScreen(),
              ),
              _buildMenuTile(
                icon: LucideIcons.clipboardList,
                gradientColors: [Color(0xFF10B981), Color(0xFF059669)],
                title: "My Reports",
                subtitle: "View and manage your submitted reports",
                page: const ReportHistoryScreen(),
              ),
              Spacer(),
              Container(
                color: Colors.white,
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
                child: TextButton(
                  onPressed: () async {
                    final confirm = await showDialog(
                      context: context,
                      builder: (context) => AlertDialog(
                        backgroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        title: Text(
                          "Sign out",
                          style: GoogleFonts.inter(fontWeight: FontWeight.w600),
                        ),
                        content: Text(
                          "Are you sure you want to sign out?",
                          style: GoogleFonts.inter(),
                        ),
                        actions: [
                          Row(
                            children: [
                              Expanded(
                                child: OutlinedButton(
                                  onPressed: () {
                                    Navigator.pop(context, false);
                                  },
                                  style: OutlinedButton.styleFrom(
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    side: const BorderSide(
                                      color: Color(0xFF2563EB),
                                    ),
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 12,
                                    ),
                                  ),
                                  child: Text(
                                    "Cancel",
                                    style: GoogleFonts.inter(
                                      fontWeight: FontWeight.w500,
                                      color: Color(0xFF2563EB),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: ElevatedButton(
                                  onPressed: () {
                                    Navigator.pop(context, true);
                                  },
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFF2563EB),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 12,
                                    ),
                                  ),
                                  child: Text(
                                    "Sign out",
                                    style: GoogleFonts.inter(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    );

                    if (!context.mounted) return;

                    if (confirm == true) {
                      await Session.clear();
                      if (!context.mounted) return;
                      Navigator.pushReplacementNamed(context, '/login');
                    }
                  },
                  style: ButtonStyle(
                    backgroundColor: WidgetStatePropertyAll(Color(0xFFFFF1F2)),
                    shape: WidgetStatePropertyAll(
                      RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(LucideIcons.logOut, color: Colors.red),
                      SizedBox(width: 5),
                      Text(
                        'Sign out',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: Colors.red,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      body: PageView(
        physics: const NeverScrollableScrollPhysics(),
        controller: _pageController,
        children: <Widget>[
          HomeScreen(
            key: _homeKey,
            onProfileTap: () {
              _scaffoldKey.currentState?.openEndDrawer();
            },
          ),
          MapScreen(key: _mapKey),
          AnalyticsScreen(key: _analyticsKey),
          AlertsScreen(key: _alertsKey),
        ],
        onPageChanged: (page) {
          setState(() {
            _selectedIndex = page;
          });
        },
      ),
      bottomNavigationBar: SafeArea(
        child: Container(
          height: 64.sp,
          decoration: BoxDecoration(
            border: Border(
              top: BorderSide(color: Colors.grey.shade300, width: 1),
            ),
          ),
          child: Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.topCenter,
            children: [
              Positioned(
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildBottomNavItem(
                      icon: LucideIcons.house,
                      label: 'Home',
                      index: 0,
                    ),
                    _buildBottomNavItem(
                      icon: LucideIcons.mapPin,
                      label: 'Map',
                      index: 1,
                    ),
                    _buildBottomNavItem(label: 'Report'),
                    _buildBottomNavItem(
                      icon: LucideIcons.chartColumn,
                      label: 'Analytics',
                      index: 2,
                    ),
                    _buildBottomNavItem(
                      icon: LucideIcons.bell,
                      label: 'Alerts',
                      index: 3,
                    ),
                  ],
                ),
              ),
              Positioned(
                top: -24.sp,
                child: InkWell(
                  borderRadius: BorderRadius.circular(36),
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const ReportFormScreen(),
                    ),
                  ),
                  child: Container(
                    width: 58.sp,
                    height: 58.sp,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF3B82F6), Color(0xFF2563EB)],
                      ),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black26,
                          blurRadius: 18,
                          offset: Offset(0, 6),
                        ),
                      ],
                    ),
                    child: Center(
                      child: Icon(
                        Icons.campaign,
                        color: Colors.white,
                        size: 28.sp,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _onTappedBar(int value) {
    setState(() {
      _selectedIndex = value;
    });
    _pageController.jumpToPage(value);
  }

  Widget _buildBottomNavItem({
    IconData? icon,
    required String label,
    int? index,
  }) {
    final isSelected = _selectedIndex == index;

    final navItem = Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null)
            Icon(
              icon,
              size: 22,
              color: isSelected ? Colors.blue : Colors.black45,
            )
          else
            const SizedBox(height: 24),

          const SizedBox(height: 2),

          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 10,
              fontWeight: FontWeight.w500,
              color: isSelected ? Colors.blue : Colors.black45,
            ),
          ),
        ],
      ),
    );

    return Expanded(
      child: icon != null
          ? InkWell(
              onTap: () => _onTappedBar(index!),
              borderRadius: BorderRadius.all(Radius.circular(24)),
              child: navItem,
            )
          : navItem,
    );
  }

  String formatPhone(String phone) {
    if (phone.length != 11) return phone;

    return '${phone.substring(0, 4)} '
        '${phone.substring(4, 7)} '
        '${phone.substring(7)}';
  }

  Widget _buildMenuTile({
    required IconData icon,
    required List<Color> gradientColors,
    required String title,
    required String subtitle,
    required Widget page,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(
          bottom: BorderSide(color: Colors.grey.shade300, width: 1),
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          splashColor: const Color(0xFF2563EB).withValues(alpha: 0.15),
          highlightColor: Colors.black.withValues(alpha: 0.04),
          onTap: () async {
            final updated = await Navigator.push<bool>(
              context,
              MaterialPageRoute(builder: (context) => page),
            );

            if (updated == true && mounted) {
              setState(() {});
            }
          },
          child: Ink(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  // icon box
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(colors: gradientColors),
                      borderRadius: BorderRadius.all(Radius.circular(12)),
                    ),
                    child: Icon(icon, color: Colors.white),
                  ),

                  const SizedBox(width: 14),

                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          subtitle,
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            color: Colors.grey,
                          ),
                        ),
                      ],
                    ),
                  ),

                  const Icon(LucideIcons.chevronRight, color: Colors.grey),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
