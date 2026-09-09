import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../services/location_service.dart';
import 'report_form_screen.dart';

class HomeScreen extends StatefulWidget {
  final VoidCallback? onReportPressed;
  final VoidCallback? onMapPressed;
  final VoidCallback onProfilePressed;

  const HomeScreen({
    super.key,
    this.onReportPressed,
    this.onMapPressed,
    required this.onProfilePressed,
  });

  @override
  State<HomeScreen> createState() => HomeScreenState();
}

class _ReportBottomSheet extends StatelessWidget {
  final ReportSheetType type;
  final VoidCallback onSubmitReport;
  final VoidCallback onFindClinic;

  const _ReportBottomSheet({
    required this.type,
    required this.onSubmitReport,
    required this.onFindClinic,
  });

  @override
  Widget build(BuildContext context) {
    final data = _sheetData();

    return SafeArea(
      top: false,
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.85,
        ),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          boxShadow: [
            BoxShadow(
              color: Color(0x33000000),
              blurRadius: 20,
              offset: Offset(0, -5),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Drag handle
            Padding(
              padding: const EdgeInsets.only(top: 12, bottom: 4),
              child: Container(
                width: 40,
                height: 5,
                decoration: BoxDecoration(
                  color: const Color(0xFFE5E7EB),
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),

            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 16, 16),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: data.iconBackground,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Icon(data.icon, color: Colors.white, size: 21),
                  ),

                  const SizedBox(width: 12),

                  Expanded(
                    child: Text(
                      data.title,
                      style: GoogleFonts.inter(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF111827),
                        height: 1.2,
                      ),
                    ),
                  ),

                  GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: Container(
                      width: 32,
                      height: 32,
                      decoration: const BoxDecoration(
                        color: Color(0xFFF3F4F6),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        LucideIcons.x,
                        size: 17,
                        color: Color(0xFF6B7280),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Scrollable content
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      data.description,
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        height: 1.55,
                        color: Color(0xFF4B5563),
                      ),
                    ),

                    const SizedBox(height: 18),

                    _buildSection(data.section1Title, data.section1Items),

                    if (data.section2Title != null) ...[
                      const SizedBox(height: 18),
                      _buildSection(data.section2Title!, data.section2Items!),
                    ],

                    if (data.infoText != null) ...[
                      const SizedBox(height: 18),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEFF6FF),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFDBEAFE)),
                        ),
                        child: Text(
                          data.infoText!,
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            height: 1.5,
                            color: Color(0xFF1E40AF),
                          ),
                        ),
                      ),
                    ],

                    const SizedBox(height: 18),

                    // Submit Report
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => const ReportFormScreen(),
                          ),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF2563EB),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: Text(
                          'Submit a Report Now',
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: 10),

                    // Find Clinic
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: onFindClinic,
                        icon: const Icon(
                          LucideIcons.mapPin,
                          size: 18,
                          color: Color(0xFF0D9488),
                        ),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF374151),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          side: const BorderSide(color: Color(0xFFE5E7EB)),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        label: Text(
                          'Find a Nearby Clinic',
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSection(String title, List<String> items) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title.toUpperCase(),
          style: GoogleFonts.inter(
            fontSize: 11,
            fontWeight: FontWeight.bold,
            letterSpacing: 1.1,
            color: Color(0xFF6B7280),
          ),
        ),
        const SizedBox(height: 8),

        ...items.map(
          (item) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Padding(
                  padding: EdgeInsets.only(top: 2),
                  child: Icon(
                    LucideIcons.circleCheck,
                    size: 16,
                    color: Color(0xFF3B82F6),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    item,
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      height: 1.4,
                      color: Color(0xFF374151),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  _ReportSheetData _sheetData() {
    switch (type) {
      case ReportSheetType.waterQualityIssue:
        return _ReportSheetData(
          title: 'Feeling Sick After Eating or Drinking?',
          icon: LucideIcons.triangleAlert,
          iconBackground: const Color(0xFFEF4444),
          description:
              'You should file a report if you experience symptoms within 72 hours of eating or drinking — especially if the food or water itself seemed off. Drinking water is required to be clear, colorless, and free from unusual taste or odor.',
          section1Title: 'Common Symptoms & Warning Signs',
          section1Items: [
            'Nausea or vomiting',
            'Diarrhea (3 or more loose stools in 24 hours)',
            'Stomach cramps or abdominal pain',
            'Fever above 38°C',
            'Headache or body weakness',
            'Signs of dehydration (dry mouth, dizziness)',
            'The food or water tasted, smelled, or looked unusual',
          ],
          section2Title: 'Report as Soon as Possible If',
          section2Items: [
            'Symptoms started within hours of a specific meal or drink',
            'Others who ate or drank the same thing are also sick',
            'Symptoms are severe or worsening',
            'A child, elderly person, or pregnant woman is affected',
            'The source was a refilling station, vendor, or dispenser',
          ],
          infoText:
              'Early reporting helps authorities prevent more people from getting sick.',
        );

      case ReportSheetType.foodOrWaterUnfitForConsumption:
        return _ReportSheetData(
          title: 'Others Affected, or Suspect Contamination?',
          icon: LucideIcons.shieldAlert,
          iconBackground: Color(0xFFF97316),
          description:
              'If two or more people became ill after sharing the same food, drink, or water source, this may be a foodborne illness cluster. Health officers are also authorized to sample and stop the sale of doubtful food or water on their own — you don\'t need lab-confirmed proof to report.',
          section1Title: 'What to Do',
          section1Items: [
            'Each affected person should file a separate report',
            'Note the shared meal or water source, location, and time',
            'List everyone who consumed the same food or water',
            'Preserve any leftover food or water — do not discard it',
            'Note the restaurant, vendor, or establishment name',
          ],
          section2Title: 'Information to Gather',
          section2Items: [
            'Name and address of the food or water establishment',
            'Date and time of the meal or purchase',
            'Specific foods or water consumed by each person',
            'Time symptoms started for each person',
            'Any visible defects (color, smell, taste, packaging)',
          ],
          infoText:
              'Group reports are taken seriously and trigger faster investigation. Confirmed contaminated or spoiled items can be confiscated or destroyed by health authorities.',
        );

      case ReportSheetType.unsafeSystemOrEstablishment:
        return _ReportSheetData(
          title:
              'Not Sure If It\'s Food-Related — or Spotted Something Unsafe?',
          icon: LucideIcons.circleQuestionMark,
          iconBackground: const Color(0xFFA855F7),
          description:
              'Not every stomach problem is caused by food, and not every reportable issue involves getting sick. Some unsafe conditions are worth reporting on their own — before anyone falls ill.',
          section1Title: 'Possible Signs',
          section1Items: [
            'Symptoms appeared after eating a particular meal',
            'Other people who ate or drank the same thing became sick',
            'The food or water tasted, smelled, or looked unusual',
            'Workers who appear visibly sick handling food or water',
            'Smoking, eating, or vermin signs in prep/storage areas',
          ],
          section2Title: 'When to Report',
          section2Items: [
            'You suspect a specific food, water source, or establishment',
            'Symptoms are severe or worsening',
            'Multiple people are affected',
            'The unsafe condition seems ongoing, even without anyone sick yet',
          ],
          infoText:
              'When in doubt, you can still submit a report. Health authorities can assess the information you provide and take appropriate action.',
        );

      case ReportSheetType.informationNeeded:
        return _ReportSheetData(
          title: 'What Information Do I Need?',
          icon: LucideIcons.utensils,
          iconBackground: const Color(0xFF0D9488),
          description:
              'Having accurate information helps health authorities investigate your report more effectively.',
          section1Title: 'Information to Prepare',
          section1Items: [
            'Name and address of the food establishment',
            'Date and time of the meal or purchase',
            'Specific foods or water consumed',
            'Symptoms experienced',
            'Time symptoms started',
            'Number of people affected',
          ],
          section2Title: 'Helpful Details',
          section2Items: [
            'Photos of the food, water, or establishment',
            'Receipt or proof of purchase',
            'Information about other people who became sick',
            'Any leftover food or water, if available',
          ],
          infoText:
              'You do not need to have every detail before submitting a report. Provide as much accurate information as you can.',
        );
    }
  }
}

class _ReportSheetData {
  final String title;
  final IconData icon;
  final Color iconBackground;
  final String description;

  final String section1Title;
  final List<String> section1Items;

  final String? section2Title;
  final List<String>? section2Items;

  final String? infoText;

  const _ReportSheetData({
    required this.title,
    required this.icon,
    required this.iconBackground,
    required this.description,
    required this.section1Title,
    required this.section1Items,
    this.section2Title,
    this.section2Items,
    this.infoText,
  });
}

class HomeScreenState extends State<HomeScreen> {
  late String locationText;
  bool isLocationLoading = true;
  int? expandedTip;

  String _normalizeDistrictLabel(String value) {
    final cleaned = value
        .trim()
        .replaceAll(RegExp(r'[_-]+'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ');
    final match = RegExp(
      r'^district\s*(\d+)$',
      caseSensitive: false,
    ).firstMatch(cleaned);
    if (match != null) return 'District ${match.group(1)}';
    return cleaned;
  }

  String _composeHeaderLocation(String fallback) {
    final manila = LocationService.cachedManilaLocation;
    if (manila != null) {
      final district = _normalizeDistrictLabel(manila.district);
      final barangayNo = manila.barangayNo;
      if (barangayNo > 0) return '$district, Barangay $barangayNo';
      final barangay = manila.barangay.trim();
      if (barangay.isNotEmpty) return '$district, $barangay';
      return district;
    }
    return fallback;
  }

  final List<Map<String, dynamic>> safetyTips = [
    {
      'title': 'Stay Out of the Danger Zone',
      'icon': LucideIcons.thermometer,
      'color': Colors.orange,
      'description':
          'Keep perishable food at 7°C (45°F) or below, or 60°C (140°F) or above — never left sitting in between during prep, service, or display.',
    },
    {
      'title': 'Match Storage Temps to the Food',
      'icon': LucideIcons.snowflake,
      'color': Colors.cyan,
      'description':
          'Frozen foods: -12°C or colder. Meat and fish: 0–3°C. Milk and dairy: 5–7°C. Fruits and vegetables: 7–10°C. Dry storage: around 10–15°C.',
    },
    {
      'title': 'Sanitize with the Right Dose and Time',
      'icon': LucideIcons.droplets,
      'color': Colors.teal,
      'description':
          'For manual sanitizing of containers and caps, immerse in a 50–100 ppm chlorine bath for at least 2 minutes in lukewarm water.',
    },
    {
      'title': 'Wash Hands Often, Not Just Once',
      'icon': LucideIcons.hand,
      'color': Colors.blue,
      'description':
          'Wash hands, arms, and nails before working, and again after smoking, using the toilet, coughing, or sneezing into your hands.',
    },
    {
      'title': 'Sick Workers Stay Off the Line',
      'icon': LucideIcons.userX,
      'color': Colors.red,
      'description':
          'Anyone with boils, infected wounds, colds, respiratory infection, diarrhea, or GI upsets should not handle food or water processing.',
    },
    {
      'title': 'No Smoking in Prep or Wash Areas',
      'icon': LucideIcons.cigaretteOff,
      'color': Colors.deepOrange,
      'description':
          'Using, chewing, or smoking tobacco is prohibited while preparing or serving food, or while washing equipment and containers.',
    },
    {
      'title': 'Fill and Cap Without Contamination',
      'icon': LucideIcons.utensilsCrossed,
      'color': Colors.indigo,
      'description':
          'Never let hands or surfaces touch food or water during filling — cap or cover containers immediately after.',
    },
    {
      'title': "Don't Hold It Too Long",
      'icon': LucideIcons.clock,
      'color': Colors.purple,
      'description':
          'Refilled water shouldn\'t sit longer than 24 hours, and should be stored cool and off the floor to allow air circulation and inspection.',
    },
    {
      'title': 'Keep Prep Areas Single-Purpose',
      'icon': LucideIcons.shield,
      'color': Colors.brown,
      'description':
          'Food and water processing or selling areas shouldn\'t double as storage for groceries, cosmetics, or other unrelated items.',
    },
  ];

  void _showReportBottomSheet(ReportSheetType type) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return _ReportBottomSheet(
          type: type,
          onSubmitReport: () {
            Navigator.pop(context);

            if (widget.onReportPressed != null) {
              widget.onReportPressed!();
            }
          },
          onFindClinic: () {
            Navigator.pop(context);

            if (widget.onMapPressed != null) {
              widget.onMapPressed!();
            }
          },
        );
      },
    );
  }

  @override
  void initState() {
    super.initState();

    locationText = _composeHeaderLocation(
      LocationService.cachedAddress ?? "Fetching...",
    );

    // Load cached/current location
    _loadHeaderLocation();

    // Refresh in background
    LocationService.getUserAddress(forceRefresh: true).then((updated) {
      if (!mounted) return;

      setState(() {
        locationText = _composeHeaderLocation(updated);
        isLocationLoading = false;
      });
    });
  }

  Future<void> _loadHeaderLocation() async {
    try {
      final address = await LocationService.getUserAddress();

      if (!mounted) return;

      setState(() {
        locationText = _composeHeaderLocation(address);
        isLocationLoading = false;
      });
    } catch (_) {
      if (!mounted) return;

      setState(() {
        isLocationLoading = false;
      });
    }
  }

  Future<void> refreshData() async {
    setState(() {
      isLocationLoading = true;
    });

    try {
      final updated = await LocationService.getUserAddress(forceRefresh: true);

      if (!mounted) return;

      setState(() {
        locationText = _composeHeaderLocation(updated);
        isLocationLoading = false;
      });
    } catch (_) {
      if (!mounted) return;

      setState(() {
        isLocationLoading = false;
      });
    }
  }

  Widget _buildSkeleton({
    required double width,
    required double height,
    double borderRadius = 6,
  }) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.25),
        borderRadius: BorderRadius.circular(borderRadius),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: refreshData,
          color: const Color(0xFF2563EB),
          child: SingleChildScrollView(
            child: Column(
              children: [
                _buildHeader(now),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 20, 16, 30),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildHowItWorks(),
                      const SizedBox(height: 24),
                      _buildWhenToReport(),
                      const SizedBox(height: 24),
                      _buildNearbyClinic(),
                      const SizedBox(height: 24),
                      _buildFoodSafetyTips(),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ----------------------------------------------------------
  // HEADER
  // ----------------------------------------------------------

  Widget _buildHeader(DateTime now) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 28),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF2563EB), Color(0xFF1D4ED8)],
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(28),
          bottomRight: Radius.circular(28),
        ),
      ),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [Image.asset('assets/foodsafe_logo.png', scale: 7)],
                ),
              ),

              // Profile button
              Material(
                color: Colors.white.withValues(alpha: 0.18),
                shape: const CircleBorder(),
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: widget.onProfilePressed,
                  child: const Padding(
                    padding: EdgeInsets.all(10),
                    child: Icon(
                      LucideIcons.user,
                      color: Colors.white,
                      size: 22,
                    ),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 22),

          // Location card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white.withValues(alpha: 0.20)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    // Location icon / skeleton
                    isLocationLoading
                        ? _buildSkeleton(width: 18, height: 18, borderRadius: 9)
                        : const Icon(
                            LucideIcons.mapPin,
                            color: Colors.white,
                            size: 18,
                          ),

                    const SizedBox(width: 8),

                    // Location text / skeleton
                    isLocationLoading
                        ? _buildSkeleton(width: 180, height: 22)
                        : Flexible(
                            child: Text(
                              locationText,
                              overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.inter(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 18,
                              ),
                            ),
                          ),
                  ],
                ),

                const SizedBox(height: 4),

                // Date / skeleton
                isLocationLoading
                    ? _buildSkeleton(width: 180, height: 14)
                    : Text(
                        _formatDate(now),
                        style: GoogleFonts.inter(
                          color: const Color(0xFFDBEAFE),
                          fontSize: 12,
                        ),
                      ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime date) {
    const weekdays = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];

    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    int hour = date.hour;
    final minute = date.minute.toString().padLeft(2, '0');
    final period = hour >= 12 ? 'PM' : 'AM';

    hour = hour % 12;
    if (hour == 0) hour = 12;

    return '${weekdays[date.weekday - 1]}, '
        '${months[date.month - 1]} ${date.day}, '
        '$hour:$minute $period';
  }

  // ----------------------------------------------------------
  // HOW IT WORKS
  // ----------------------------------------------------------

  Widget _buildHowItWorks() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'How It Works',
          style: GoogleFonts.inter(
            fontSize: 18,
            fontWeight: FontWeight.w600,
            color: Color(0xFF111827),
          ),
        ),

        const SizedBox(height: 12),

        Container(
          width: double.infinity,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFF3F4F6)),
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: [
              _buildHowItWorksStep(
                number: '1',
                numberColor: const Color(0xFFEF4444),
                title: 'Notice symptoms',
                description: "Feeling unwell after eating? That's your cue.",
                dotColor: const Color(0xFFEF4444),
                showDivider: true,
              ),

              _buildHowItWorksStep(
                number: '2',
                numberColor: const Color(0xFF2563EB),
                title: 'Submit a report',
                description: 'Fill in a quick form — takes under 2 minutes.',
                dotColor: const Color(0xFF2563EB),
                showDivider: true,
              ),

              _buildHowItWorksStep(
                number: '3',
                numberColor: const Color(0xFF10B981),
                title: 'Authorities respond',
                description: 'Your report is reviewed and action is taken.',
                dotColor: const Color(0xFF10B981),
                showDivider: false,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildHowItWorksStep({
    required String number,
    required Color numberColor,
    required String title,
    required String description,
    required Color dotColor,
    required bool showDivider,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      decoration: BoxDecoration(
        border: showDivider
            ? const Border(bottom: BorderSide(color: Color(0xFFF3F4F6)))
            : null,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Number
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: numberColor,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Center(
              child: Text(
                number,
                style: GoogleFonts.inter(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),

          const SizedBox(width: 16),

          // Text
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF111827),
                  ),
                ),

                const SizedBox(height: 2),

                Text(
                  description,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    height: 1.35,
                    color: Color(0xFF9CA3AF),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ----------------------------------------------------------
  // WHEN TO REPORT
  // ----------------------------------------------------------

  Widget _buildWhenToReport() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'When to Report',
          style: GoogleFonts.inter(
            fontSize: 18,
            fontWeight: FontWeight.w600,
            color: Color(0xFF111827),
          ),
        ),
        const SizedBox(height: 12),

        _reportOption(
          title: 'I feel sick after eating or drinking',
          subtitle: 'Check if you should report',
          icon: LucideIcons.triangleAlert,
          iconColor: Colors.red,
          backgroundColor: const Color(0xFFFEF2F2),
          borderColor: const Color(0xFFFECACA),
          onTap: () =>
              _showReportBottomSheet(ReportSheetType.waterQualityIssue),
        ),

        const SizedBox(height: 10),

        _reportOption(
          title: 'Others are affected too',
          subtitle: 'Multiple people got sick, or contamination suspected',
          icon: LucideIcons.users,
          iconColor: Colors.orange,
          backgroundColor: const Color(0xFFFFF7ED),
          borderColor: const Color(0xFFFED7AA),
          onTap: () => _showReportBottomSheet(
            ReportSheetType.foodOrWaterUnfitForConsumption,
          ),
        ),

        const SizedBox(height: 10),

        _reportOption(
          title: "I'm not sure, or something looks unsafe",
          subtitle: 'How to tell, and what else is reportable',
          icon: LucideIcons.circleQuestionMark,
          iconColor: Colors.purple,
          backgroundColor: const Color(0xFFFAF5FF),
          borderColor: const Color(0xFFE9D5FF),
          onTap: () => _showReportBottomSheet(
            ReportSheetType.unsafeSystemOrEstablishment,
          ),
        ),

        const SizedBox(height: 10),

        _reportOption(
          title: 'What information do I need?',
          subtitle: 'Prepare details before you file a report',
          icon: LucideIcons.utensils,
          iconColor: const Color(0xFF0D9488),
          backgroundColor: const Color(0xFFF0FDFA),
          borderColor: const Color(0xFF99F6E4),
          onTap: () =>
              _showReportBottomSheet(ReportSheetType.informationNeeded),
        ),
      ],
    );
  }

  Widget _reportOption({
    required String title,
    required String subtitle,
    required IconData icon,
    required Color iconColor,
    required Color backgroundColor,
    required Color borderColor,
    required VoidCallback onTap,
  }) {
    return Material(
      color: backgroundColor,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(15),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: borderColor),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: iconColor,
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Icon(icon, color: Colors.white, size: 19),
              ),

              const SizedBox(width: 12),

              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF111827),
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      subtitle,
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: Color(0xFF6B7280),
                      ),
                    ),
                  ],
                ),
              ),

              const Icon(
                LucideIcons.chevronRight,
                color: Color(0xFF9CA3AF),
                size: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ----------------------------------------------------------
  // NEARBY CLINIC
  // ----------------------------------------------------------

  Widget _buildNearbyClinic() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Find a Nearby Clinic',
          style: GoogleFonts.inter(
            fontSize: 18,
            fontWeight: FontWeight.w600,
            color: Color(0xFF111827),
          ),
        ),
        const SizedBox(height: 12),

        Material(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: widget.onMapPressed,
            child: Container(
              width: double.infinity,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE0F2FE)),
              ),
              clipBehavior: Clip.antiAlias,
              child: Row(
                children: [
                  SizedBox(width: 112, height: 90, child: _buildMapPreview()),

                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 14,
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Clinics & Hospitals',
                                  style: GoogleFonts.inter(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF111827),
                                  ),
                                ),
                                SizedBox(height: 3),
                                Text(
                                  '12 facilities in Manila',
                                  style: GoogleFonts.inter(
                                    fontSize: 12,
                                    color: Color(0xFF0284C7),
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                SizedBox(height: 4),
                                Text(
                                  'Tap to open map view',
                                  style: GoogleFonts.inter(
                                    fontSize: 11,
                                    color: Color(0xFF9CA3AF),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const Icon(
                            LucideIcons.chevronRight,
                            color: Color(0xFF9CA3AF),
                            size: 20,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMapPreview() {
    return Container(
      color: const Color(0xFFF0F9FF),
      child: Stack(
        children: [
          // Buildings
          Positioned(left: 8, top: 8, child: _building(30, 18)),
          Positioned(left: 46, top: 8, child: _building(22, 14)),
          Positioned(right: 8, top: 10, child: _building(28, 20)),
          Positioned(left: 8, bottom: 30, child: _building(20, 22)),
          Positioned(left: 36, bottom: 32, child: _building(30, 16)),
          Positioned(right: 8, bottom: 26, child: _building(30, 24)),

          // Roads
          Positioned(
            left: 0,
            right: 0,
            top: 28,
            child: Container(height: 4, color: const Color(0xFF7DD3FC)),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 24,
            child: Container(height: 3, color: const Color(0xFF7DD3FC)),
          ),
          Positioned(
            top: 0,
            bottom: 0,
            left: 40,
            child: Container(width: 4, color: const Color(0xFF7DD3FC)),
          ),
          Positioned(
            top: 0,
            bottom: 0,
            left: 74,
            child: Container(width: 3, color: const Color(0xFF7DD3FC)),
          ),

          // Map markers
          const Positioned(
            left: 16,
            bottom: 30,
            child: Icon(Icons.location_on, size: 12, color: Color(0x660284C7)),
          ),
          const Positioned(
            left: 51,
            top: 8,
            child: Icon(Icons.location_on, size: 12, color: Color(0x660284C7)),
          ),
          const Positioned(
            right: 15,
            bottom: 29,
            child: Icon(Icons.location_on, size: 12, color: Color(0x660284C7)),
          ),

          // Main marker
          const Center(
            child: Icon(Icons.location_on, color: Color(0xFF0284C7), size: 28),
          ),
        ],
      ),
    );
  }

  Widget _building(double width, double height) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: const Color(0xFFBAE6FD),
        borderRadius: BorderRadius.circular(2),
      ),
    );
  }

  // ----------------------------------------------------------
  // FOOD SAFETY TIPS
  // ----------------------------------------------------------

  Widget _buildFoodSafetyTips() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Food Safety Tips',
          style: GoogleFonts.inter(
            fontSize: 18,
            fontWeight: FontWeight.w600,
            color: Color(0xFF111827),
          ),
        ),
        const SizedBox(height: 12),

        Container(
          width: double.infinity,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFF3F4F6)),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Column(
              children: List.generate(safetyTips.length, (index) {
                final tip = safetyTips[index];
                final isExpanded = expandedTip == index;

                return Column(
                  children: [
                    Material(
                      color: Colors.white,
                      child: InkWell(
                        onTap: () {
                          setState(() {
                            expandedTip = isExpanded ? null : index;
                          });
                        },
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 14,
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 32,
                                height: 32,
                                decoration: BoxDecoration(
                                  color: tip['color'],
                                  borderRadius: BorderRadius.circular(9),
                                ),
                                child: Icon(
                                  tip['icon'],
                                  color: Colors.white,
                                  size: 17,
                                ),
                              ),
                              const SizedBox(width: 12),

                              Expanded(
                                child: Text(
                                  tip['title'],
                                  style: GoogleFonts.inter(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w500,
                                    color: Color(0xFF111827),
                                  ),
                                ),
                              ),

                              AnimatedRotation(
                                turns: isExpanded ? 0.5 : 0,
                                duration: const Duration(milliseconds: 200),
                                child: const Icon(
                                  LucideIcons.chevronDown,
                                  color: Color(0xFF9CA3AF),
                                  size: 20,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),

                    AnimatedCrossFade(
                      duration: const Duration(milliseconds: 200),
                      crossFadeState: isExpanded
                          ? CrossFadeState.showSecond
                          : CrossFadeState.showFirst,
                      firstChild: const SizedBox.shrink(),
                      secondChild: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.fromLTRB(60, 0, 16, 16),
                        child: Text(
                          tip['description'],
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            height: 1.5,
                            color: Color(0xFF6B7280),
                          ),
                        ),
                      ),
                    ),

                    if (index < safetyTips.length - 1)
                      const Divider(
                        height: 1,
                        indent: 16,
                        endIndent: 16,
                        color: Color(0xFFF3F4F6),
                      ),
                  ],
                );
              }),
            ),
          ),
        ),
      ],
    );
  }
}

enum ReportSheetType {
  waterQualityIssue,
  foodOrWaterUnfitForConsumption,
  unsafeSystemOrEstablishment,
  informationNeeded,
}
