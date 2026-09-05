import 'dart:async';

import 'package:flutter/material.dart';
import 'package:foodsafe_manila/screens/report_history_screen.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../widgets/snackbar_widgets.dart';
import '../services/api_service.dart';
import '../services/api_client.dart';
import '../services/location_service.dart';
import '../services/manila_geo_service.dart';
import '../services/session.dart';
import '../utils/format_helpers.dart';
import '../widgets/app_loading.dart';
import 'dart:convert';
import 'package:flutter/services.dart' show rootBundle;

class ReportFormScreen extends StatefulWidget {
  const ReportFormScreen({super.key});

  @override
  State<ReportFormScreen> createState() => _ReportFormScreenState();
}

class _ReportFormScreenState extends State<ReportFormScreen> {
  bool isLoading = false;
  int _currentStep = 0;

  Future<void> _nextStep() async {
    if (_currentStep == 0) {
      setState(() => _currentStep = 1);
      return;
    }
    if (_currentStep == 1) {
      setState(() => _currentStep = 2);
      return;
    }
    if (_currentStep == 2) {
      final success = await _submit();

      if (!success) return;

      setState(() => _currentStep = 3);
      return;
    }
  }

  Future<bool> _submit() async {
    if (isLoading) return false;

    setState(() => isLoading = true);

    try {
      // Check if user is logged in
      if (Session.currentUser == null) {
        if (context.mounted) {
          SnackbarWidgets.error(context, "Please log in first");
        }
        return false;
      }

      // Get the current user's ID
      final userId = (Session.currentUser!['_id'] ?? Session.currentUser!['id'])
          ?.toString();
      if (userId == null || userId.isEmpty) {
        if (context.mounted) {
          SnackbarWidgets.error(context, "User ID not found");
        }
        return false;
      }

      final allowed = await _checkCooldown(userId);
      if (!allowed) return false;

      final reportedSymptoms =
          FormatHelpers.formatSymptoms(selectedSymptoms).toList();
      final coordinates = await LocationService.getCurrentCoordinates();

      if (coordinates == null) {
        if (mounted) {
          SnackbarWidgets.error(context, "Unable to get current coordinates");
        }
        return false;
      }

      // Ensure coordinates are within Manila City boundaries
      final lat = coordinates['lat'] ?? 0.0;
      final lng = coordinates['lng'] ?? 0.0;

      final usingDebugLocation = await LocationService.isUsingDebugLocation();
      final insideManila =
          usingDebugLocation || await _isWithinManila(lat, lng);

      if (!insideManila) {
        if (mounted) {
          SnackbarWidgets.error(
            context,
            "Reports are only accepted within the City of Manila",
          );
        }
        return false;
      }

      await ManilaGeoService.ensureLoaded();
      final resolved = LocationService.cachedManilaLocation ??
          ManilaGeoService.lookup(lat, lng);
      if (resolved == null) {
        if (mounted) {
          SnackbarWidgets.error(
            context,
            'Unable to resolve barangay within Manila',
          );
        }
        return false;
      }

      final locationPayload = {
        ...resolved.toPayload(),
        'coordinates': {'lat': lat, 'lng': lng},
      };

      String? exposureDistrict;
      String? exposureBarangay;
      int? exposureBarangayNo;

      if (selectedAteFoodLocation ==
          'Same as my current district location') {
        exposureDistrict = resolved.district;
        exposureBarangay = resolved.barangayNo > 0
            ? 'Barangay ${resolved.barangayNo}'
            : resolved.barangay;
        exposureBarangayNo = resolved.barangayNo;
      } else if (selectedAteFoodLocation == 'Choose a different district') {
        exposureDistrict =
            FormatHelpers.normalizeDistrict(selectedDistrict);
        exposureBarangay = selectedExposureBarangay;
        exposureBarangayNo = selectedExposureBarangayNo;
      }

      final success = await ApiService.submitReport(
        reportLocation: resolved.formatted,
        symptoms: reportedSymptoms,
        foodSource: selectedFoodSource ?? 'Not specified',
        exposureDistrict: exposureDistrict,
        exposureBarangay: exposureBarangay,
        exposureBarangayNo: exposureBarangayNo,
        location: locationPayload,
      );

      if (success) {
        if (mounted) {
          SnackbarWidgets.success(context, "Report submitted successfully!");
        }

        setState(() {
          _remainingCooldown = reportCooldown;
          isCooldown = true;
          _updateTimeText();
        });

        _startTimer();

        return true;
      } else {
        if (mounted) {
          SnackbarWidgets.error(context, "Failed to submit report");
        }
        return false;
      }
    } on ApiException catch (e) {
      if (mounted) {
        SnackbarWidgets.error(context, ApiClient.safeErrorMessage(e));
      }
      return false;
    } catch (error) {
      if (mounted) {
        SnackbarWidgets.error(
          context,
          ApiClient.safeErrorMessage(
            error,
            fallback: 'The report could not be submitted.',
          ),
        );
      }
      return false;
    } finally {
      if (mounted) {
        setState(() => isLoading = false);
      }
    }
  }

  static const Duration reportCooldown = Duration(hours: 8);

  Duration? _remainingCooldown;
  Timer? _cooldownTimer;

  bool isCooldown = false;
  String timeLeft = "";

  Future<bool> _checkCooldown(String userId) async {
    final lastReportTime = await ApiService.getLastReportTime(userId);

    if (lastReportTime == null) return true;

    final difference = DateTime.now().difference(lastReportTime);

    if (difference >= reportCooldown) return true;

    final remaining = reportCooldown - difference;

    final hours = remaining.inHours;
    final minutes = remaining.inMinutes % 60;
    final seconds = remaining.inSeconds % 60;

    if (mounted) {
      SnackbarWidgets.error(
        context,
        "You can submit again in $hours h $minutes m $seconds s",
      );
    }

    return false;
  }

  Future<void> _initCooldown() async {
    if (Session.currentUser == null) return;

    final userId = (Session.currentUser!['_id'] ?? Session.currentUser!['id'])
        ?.toString();
    if (userId == null) return;

    final lastReportTime = await ApiService.getLastReportTime(userId);

    if (lastReportTime == null) return;

    final diff = DateTime.now().difference(lastReportTime);

    if (diff < reportCooldown) {
      setState(() {
        _remainingCooldown = reportCooldown - diff;
        isCooldown = true;
        _updateTimeText();
      });

      _startTimer();
    }
  }

  void _updateTimeText() {
    if (_remainingCooldown == null) return;

    final h = _remainingCooldown!.inHours;
    final m = _remainingCooldown!.inMinutes % 60;
    final s = _remainingCooldown!.inSeconds % 60;

    timeLeft = "${h}h ${m}m ${s}s";
  }

  void _startTimer() {
    _cooldownTimer?.cancel();

    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_remainingCooldown == null) return;

      if (_remainingCooldown!.inSeconds <= 1) {
        timer.cancel();
        setState(() {
          isCooldown = false;
          _remainingCooldown = null;
          timeLeft = "";
        });
      } else {
        setState(() {
          _remainingCooldown = Duration(
            seconds: _remainingCooldown!.inSeconds - 1,
          );

          _updateTimeText();
        });
      }
    });
  }

  List<dynamic>? _manilaFeatures;

  Future<bool> _isWithinManila(double lat, double lng) async {
    try {
      if (_manilaFeatures == null) {
        final raw = await rootBundle.loadString(
          'assets/manila-barangays-with-legislative-districts.json',
        );

        final data = json.decode(raw) as Map<String, dynamic>;
        _manilaFeatures = data['features'] as List<dynamic>;
      }

      for (final feature in _manilaFeatures!) {
        final geometry = feature['geometry'] as Map<String, dynamic>?;

        if (geometry == null) continue;

        final type = geometry['type'];
        final coordinates = geometry['coordinates'];

        if (type == 'Polygon') {
          final polygonRings = coordinates as List<dynamic>;

          for (final ring in polygonRings) {
            final polygon = (ring as List).map<List<double>>((point) {
              return [
                (point[0] as num).toDouble(), // lng
                (point[1] as num).toDouble(), // lat
              ];
            }).toList();

            if (_pointInPolygon(lng, lat, polygon)) {
              return true;
            }
          }
        }

        else if (type == 'MultiPolygon') {
          final multiPolygons = coordinates as List<dynamic>;

          for (final polygonGroup in multiPolygons) {
            for (final ring in polygonGroup) {
              final polygon = (ring as List).map<List<double>>((point) {
                return [
                  (point[0] as num).toDouble(),
                  (point[1] as num).toDouble(),
                ];
              }).toList();

              if (_pointInPolygon(lng, lat, polygon)) {
                return true;
              }
            }
          }
        }
      }

      return false;
    } catch (_) {
      return false;
    }
  }

  // Ray-casting algorithm: point x/y against polygon [[x,y],...]
  bool _pointInPolygon(double x, double y, List<List<double>> polygon) {
    var inside = false;
    for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      final xi = polygon[i][0], yi = polygon[i][1];
      final xj = polygon[j][0], yj = polygon[j][1];

      final intersect =
          ((yi > y) != (yj > y)) &&
          (x < (xj - xi) * (y - yi) / (yj - yi + 0.0) + xi);
      if (intersect) inside = !inside;
    }

    return inside;
  }

  final List<String> symptoms = [
    'Nausea',
    'Vomiting',
    'Diarrhea',
    'Abdominal cramps',
    'Fever',
    'Headache',
    'Dehydration',
  ];

  final List<String> foodSources = [
    'Restaurant',
    'Street food vendor',
    'Home-cooked meal',
    'Food delivery',
    'Cafeteria',
    'Other',
  ];

  final List<String> ateFoodLocations = [
    'Same as my current district location',
    'Choose a different district',
  ];

  final Set<String> selectedSymptoms = {};
  String? selectedAteFoodLocation;
  int affectedPeople = 1;
  String? selectedFoodSource;
  String? selectedDistrict;
  String? selectedExposureBarangay;
  int? selectedExposureBarangayNo;
  List<Map<String, dynamic>> exposureBarangayOptions = [];

  late String locationText;

  @override
  void initState() {
    super.initState();
    _loadHeader();
    locationText = LocationService.cachedAddress ?? 'Fetching...';

    LocationService.resolveManilaLocation(forceRefresh: true).then((resolved) {
      if (!mounted || resolved == null) return;
      setState(() {
        locationText = resolved.formatted;
      });
    });
    _initCooldown();
  }

  void _loadExposureBarangays(String district) {
    exposureBarangayOptions = ManilaGeoService.barangaysForDistrict(district);
    selectedExposureBarangay = null;
    selectedExposureBarangayNo = null;
  }

  @override
  void dispose() {
    _cooldownTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadHeader() async {
    LocationService.getUserAddress().then((address) {
      setState(() {
        locationText = address;
      });
    });
  }

  String get _exposureLocationDisplay {
    if (selectedAteFoodLocation == 'Choose a different district') {
      return FormatHelpers.formatLocationDisplay(
        district: selectedDistrict ?? '',
        barangayNo: selectedExposureBarangayNo,
      );
    }
    return locationText;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: SafeArea(
        top: true,
        child: Column(
          children: [
            // Sticky Header
            Container(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border(bottom: BorderSide(color: Colors.grey.shade300)),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      IconButton(
                        onPressed: () {
                          if (_currentStep > 0 && _currentStep < 3) {
                            setState(() => _currentStep--);
                          } else {
                            Navigator.pop(context);
                          }
                        },
                        icon: const Icon(
                          LucideIcons.arrowLeft,
                          color: Color(0xFF4B5563),
                        ),
                      ),
                      Expanded(
                        child: Center(
                          child: Text(
                            'Report Symptoms',
                            style: GoogleFonts.inter(
                              fontSize: 18,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 48),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _stepProgressBar(),
                ],
              ),
            ),

            // Body
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 24,
                ),
                child: Column(
                  children: [
                    _currentStep != 3
                        ? Column(
                            children: [
                              isCooldown
                                  ? Container(
                                      padding: const EdgeInsets.all(12), // p-3
                                      decoration: BoxDecoration(
                                        color: const Color(
                                          0xFFFFFBEB,
                                        ), // bg-amber-50
                                        border: Border.all(
                                          color: const Color(0xFFFCD34D),
                                        ), // border-amber-300
                                        borderRadius: BorderRadius.circular(
                                          12,
                                        ), // rounded-xl
                                      ),
                                      child: Row(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.center,
                                        children: [
                                          // Icon container
                                          Container(
                                            width: 32,
                                            height: 32,
                                            decoration: BoxDecoration(
                                              color: const Color(
                                                0xFFF59E0B,
                                              ), // bg-amber-500
                                              borderRadius:
                                                  BorderRadius.circular(
                                                    8,
                                                  ), // rounded-lg
                                            ),
                                            child: const Center(
                                              child: Icon(
                                                LucideIcons.clock,
                                                size: 16,
                                                color: Colors.white,
                                              ),
                                            ),
                                          ),

                                          const SizedBox(width: 12), // gap-3
                                          // Text content
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                RichText(
                                                  text: TextSpan(
                                                    style: GoogleFonts.inter(
                                                      fontSize: 12, // text-xs
                                                      color: Color(
                                                        0xFF78350F,
                                                      ), // text-amber-900
                                                    ),
                                                    children: [
                                                      TextSpan(
                                                        text:
                                                            "Cooldown Active: ",
                                                        style:
                                                            GoogleFonts.inter(
                                                              fontWeight:
                                                                  FontWeight
                                                                      .bold,
                                                            ),
                                                      ),
                                                      TextSpan(
                                                        text:
                                                            "Next report available in",
                                                      ),
                                                    ],
                                                  ),
                                                ),

                                                const SizedBox(
                                                  height: 2,
                                                ), // mb-0.5

                                                Text(
                                                  timeLeft, // e.g. "44s"
                                                  style: GoogleFonts.inter(
                                                    fontSize: 14, // text-sm
                                                    fontWeight: FontWeight.bold,
                                                    color: Color(
                                                      0xFFB45309,
                                                    ), // text-amber-700
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                    )
                                  : Container(
                                      padding: const EdgeInsets.all(12), // p-3
                                      decoration: BoxDecoration(
                                        color: const Color(
                                          0xFFEFF6FF,
                                        ), // bg-blue-50
                                        border: Border.all(
                                          color: const Color(0xFFBFDBFE),
                                        ), // border-blue-200
                                        borderRadius: BorderRadius.circular(
                                          12,
                                        ), // rounded-xl
                                      ),
                                      child: Row(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.center,
                                        children: [
                                          // Icon container
                                          Container(
                                            width: 32,
                                            height: 32,
                                            decoration: BoxDecoration(
                                              color: const Color(
                                                0xFF2563EB,
                                              ), // bg-blue-600
                                              borderRadius:
                                                  BorderRadius.circular(
                                                    8,
                                                  ), // rounded-lg
                                            ),
                                            child: const Center(
                                              child: Icon(
                                                LucideIcons.info,
                                                size: 16,
                                                color: Colors.white,
                                              ),
                                            ),
                                          ),

                                          const SizedBox(width: 12), // gap-3
                                          // Text
                                          Expanded(
                                            child: RichText(
                                              text: TextSpan(
                                                style: GoogleFonts.inter(
                                                  fontSize: 12, // text-xs
                                                  color: Color(
                                                    0xFF1E40AF,
                                                  ), // text-blue-800
                                                ),
                                                children: [
                                                  TextSpan(
                                                    text: "Note: ",
                                                    style: GoogleFonts.inter(
                                                      fontWeight:
                                                          FontWeight.bold,
                                                    ),
                                                  ),
                                                  TextSpan(
                                                    text:
                                                        "You can submit a report every 8 hours to prevent spam.",
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),

                              const SizedBox(height: 20),
                            ],
                          )
                        : SizedBox.shrink(),

                    buildStepContent(),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _stepProgressBar() {
    int totalSteps = 3;

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: List.generate(totalSteps, (index) {
        bool isActive = index <= _currentStep;
        bool isCurrent = index == _currentStep;
        return Expanded(
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 4),
            height: 6,
            decoration: BoxDecoration(
              color: isCurrent
                  ? const Color(0xFF2563EB)
                  : isActive
                  ? const Color(0xFF93C5FD)
                  : Colors.grey.shade300,
              borderRadius: BorderRadius.circular(3),
            ),
          ),
        );
      }),
    );
  }

  Widget buildStepContent() {
    switch (_currentStep) {
      case 0:
        return _firstStep();
      case 1:
        return _secondStep();
      case 2:
        return _thirdStep();
      case 3:
        return _fourthStep();
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _firstStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'What symptoms are you experiencing?',
          style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 8),
        Text(
          'Select all that apply',
          style: GoogleFonts.inter(fontSize: 14, color: Color(0xFF6B7280)),
        ),
        const SizedBox(height: 20),

        // Symptoms List
        ...symptoms.map((symptom) {
          final isSelected = selectedSymptoms.contains(symptom);

          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () {
                setState(() {
                  if (isSelected) {
                    selectedSymptoms.remove(symptom);
                  } else {
                    selectedSymptoms.add(symptom);
                  }
                });
              },
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 16,
                ),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isSelected
                        ? const Color(0xFF2563EB)
                        : const Color(0xFFE5E7EB),
                    width: 2,
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        symptom,
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                    Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: isSelected
                              ? const Color(0xFF2563EB)
                              : const Color(0xFFD1D5DB),
                          width: 2,
                        ),
                        color: isSelected
                            ? const Color(0xFF2563EB)
                            : Colors.transparent,
                      ),
                      child: isSelected
                          ? const Icon(
                              LucideIcons.check,
                              size: 14,
                              color: Colors.white,
                            )
                          : null,
                    ),
                  ],
                ),
              ),
            ),
          );
        }),

        const SizedBox(height: 20),

        // Food Source Dropdown
        Text(
          'Suspected food source (optional)',
          style: GoogleFonts.inter(
            fontSize: 14,
            color: Color(0xFF374151),
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 8),
        dropdownButton(
          initialSelection: selectedFoodSource,
          hintText: 'Select source...',
          dropdownMenuEntries: foodSources,
          onSelected: (value) {
            setState(() {
              selectedFoodSource = value;
            });
          },
        ),

        const SizedBox(height: 32),

        // Next Button
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: selectedSymptoms.isEmpty
                ? null
                : () {
                    _nextStep();
                  },
            iconAlignment: IconAlignment.end,
            icon: const Icon(LucideIcons.arrowRight),
            label: const Text('Next'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2563EB),
              disabledBackgroundColor: const Color(0xFF87ABFB),
              foregroundColor: Colors.white,
              disabledForegroundColor: Colors.white70,
              elevation: 0,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              textStyle: GoogleFonts.inter(
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _secondStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Where did the food come from?',
          style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 8),
        Text(
          'This will help us identify potential sources of contamination',
          style: GoogleFonts.inter(fontSize: 14, color: Color(0xFF6B7280)),
        ),
        const SizedBox(height: 20),
        Container(
          padding: EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.blue[50],
            border: Border.all(color: Colors.blue[200]!),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: Color(0xFF2563EB),
                  shape: BoxShape.circle,
                ),
                child: Icon(LucideIcons.mapPin, color: Colors.white, size: 20),
              ),
              SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'You are currently in',
                    style: GoogleFonts.inter(
                      color: Colors.blue[700],
                      fontSize: 12,
                    ),
                  ),
                  Text(
                    locationText,
                    style: GoogleFonts.inter(
                      color: Colors.blue[900],
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        SizedBox(height: 20),
        Text(
          'Where do you think you ate/bought the food?',
          style: GoogleFonts.inter(fontSize: 14, color: Color(0xFF6B7280)),
        ),
        SizedBox(height: 12),
        // Symptoms List
        ...ateFoodLocations.map((ateFoodLocation) {
          final isSelected = selectedAteFoodLocation == ateFoodLocation;

          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () {
                setState(() {
                  selectedAteFoodLocation = ateFoodLocation;
                });
              },
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 16,
                ),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isSelected
                        ? const Color(0xFF2563EB)
                        : const Color(0xFFE5E7EB),
                    width: 2,
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        ateFoodLocation,
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                    Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: isSelected
                              ? const Color(0xFF2563EB)
                              : const Color(0xFFD1D5DB),
                          width: 2,
                        ),
                        color: isSelected
                            ? const Color(0xFF2563EB)
                            : Colors.transparent,
                      ),
                      child: isSelected
                          ? const Icon(
                              LucideIcons.check,
                              size: 14,
                              color: Colors.white,
                            )
                          : null,
                    ),
                  ],
                ),
              ),
            ),
          );
        }),

        if (selectedAteFoodLocation == 'Choose a different district') ...[
          const SizedBox(height: 10),
          Text(
            'Select district where you ate the food',
            style: GoogleFonts.inter(
              fontSize: 14,
              color: Color(0xFF374151),
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 8),
          dropdownButton(
            initialSelection: selectedDistrict,
            hintText: 'Choose district...',
            dropdownMenuEntries: [
              "District 1",
              "District 2",
              "District 3",
              "District 4",
              "District 5",
              "District 6",
            ],
            onSelected: (value) {
              setState(() {
                selectedDistrict = value;
                if (value != null) _loadExposureBarangays(value);
              });
            },
          ),
          const SizedBox(height: 8),
          dropdownButton(
            initialSelection: selectedExposureBarangay,
            hintText: 'Choose barangay...',
            dropdownMenuEntries: exposureBarangayOptions
                .map((b) => b['label'] as String)
                .toList(),
            onSelected: (value) {
              final match = exposureBarangayOptions.cast<Map<String, dynamic>>().where(
                (b) => b['label'] == value,
              );
              final selected = match.isNotEmpty ? match.first : null;
              setState(() {
                selectedExposureBarangay = value;
                selectedExposureBarangayNo =
                    selected?['barangayNo'] as int?;
              });
            },
          ),
          const SizedBox(height: 8),
        ],

        const SizedBox(height: 16),

        // Next Button
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed:
                (selectedAteFoodLocation == null ||
                    (selectedAteFoodLocation == 'Choose a different district' &&
                        (selectedDistrict == null ||
                            selectedExposureBarangayNo == null)))
                ? null
                : () {
                    _nextStep();
                  },
            iconAlignment: IconAlignment.end,
            icon: const Icon(LucideIcons.arrowRight),
            label: const Text('Next'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2563EB),
              disabledBackgroundColor: const Color(0xFF87ABFB),
              foregroundColor: Colors.white,
              disabledForegroundColor: Colors.white70,
              elevation: 0,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              textStyle: GoogleFonts.inter(
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _thirdStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header
        Text(
          "Review Your Report",
          style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 8),
        Text(
          "Please confirm the details before submitting",
          style: GoogleFonts.inter(fontSize: 14, color: Color(0xFF6B7280)),
        ),

        const SizedBox(height: 20),

        // Card
        Container(
          padding: const EdgeInsets.all(2), // border thickness
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            gradient: const LinearGradient(
              colors: [Color(0xFF2563EB), Color(0xFF1D4ED8)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.08),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              children: [
                // Gradient Header
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 16,
                  ),
                  decoration: const BoxDecoration(
                    borderRadius: BorderRadius.vertical(
                      top: Radius.circular(18),
                    ),
                    gradient: LinearGradient(
                      colors: [Color(0xFF2563EB), Color(0xFF1D4ED8)],
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(
                          LucideIcons.info,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            "Report Summary",
                            style: GoogleFonts.inter(
                              fontSize: 16,
                              color: Colors.white,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                // Content
                Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Symptoms
                      Text(
                        "SYMPTOMS",
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          color: Colors.grey,
                          letterSpacing: 1,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 8),

                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: selectedSymptoms.map((symptom) {
                          return Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.blue.shade50,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: Colors.blue.shade200),
                            ),
                            child: Text(
                              FormatHelpers.formatSymptom(symptom),
                              style: GoogleFonts.inter(
                                fontSize: 13,
                                color: Color(0xFF1D4ED8),
                              ),
                            ),
                          );
                        }).toList(),
                      ),

                      const SizedBox(height: 16),

                      const Divider(),

                      const SizedBox(height: 16),

                      // Location
                      Text(
                        "SUSPECTED FOOD SOURCE",
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          color: Colors.grey,
                          letterSpacing: 1,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 8),

                      Row(
                        children: [
                          Icon(
                            LucideIcons.utensilsCrossed,
                            size: 16,
                            color: Colors.teal.shade600,
                          ),
                          SizedBox(width: 6),
                          Text(
                            selectedFoodSource ?? "Not specified",
                            style: GoogleFonts.inter(
                              fontWeight: FontWeight.w500,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 16),

                      const Divider(),

                      const SizedBox(height: 16),

                      // Location
                      Text(
                        "CURRENT LOCATION",
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          color: Colors.grey,
                          letterSpacing: 1,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 8),

                      Row(
                        children: [
                          Icon(
                            LucideIcons.mapPin,
                            size: 16,
                            color: Colors.blue.shade600,
                          ),
                          SizedBox(width: 6),
                          Text(
                            locationText,
                            style: GoogleFonts.inter(
                              fontWeight: FontWeight.w500,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 16),

                      const Divider(),

                      const SizedBox(height: 16),

                      // Location
                      Text(
                        "EXPOSURE LOCATION",
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          color: Colors.grey,
                          letterSpacing: 1,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 8),

                      Row(
                        children: [
                          Icon(
                            LucideIcons.map,
                            size: 16,
                            color: Colors.orange.shade600,
                          ),
                          SizedBox(width: 6),
                          Text(
                            _exposureLocationDisplay,
                            style: GoogleFonts.inter(
                              fontWeight: FontWeight.w500,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),

        const SizedBox(height: 20),

        // Warning Box
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFFFFBEB),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFFDE68A)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                LucideIcons.triangleAlert,
                size: 18,
                color: Color(0xFFD97706),
              ),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  "By submitting this report, you confirm that the information provided is accurate to the best of your knowledge.",
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: Color(0xFF78350F),
                  ),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 20),

        // Buttons
        Column(
          children: [
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: isLoading
                    ? null
                    : () async {
                        final confirm = await showDialog(
                          context: context,
                          builder: (context) => AlertDialog(
                            backgroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                            title: Text(
                              "Submit report?",
                              style: GoogleFonts.inter(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            content: Text(
                              "Are you sure you want to submit the report?",
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
                                          borderRadius: BorderRadius.circular(
                                            10,
                                          ),
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
                                        backgroundColor: const Color(
                                          0xFF2563EB,
                                        ),
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(
                                            10,
                                          ),
                                        ),
                                        padding: const EdgeInsets.symmetric(
                                          vertical: 12,
                                        ),
                                      ),
                                      child: Text(
                                        "Submit",
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
                          _nextStep();
                        }
                      },
                iconAlignment: IconAlignment.start,
                icon: isLoading ? null : const Icon(Icons.send),
                label: isLoading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: AppLoadingIndicator(
                          size: 18,
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Confirm & Submit'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2563EB),
                  disabledBackgroundColor: const Color(0xFF87ABFB),
                  foregroundColor: Colors.white,
                  disabledForegroundColor: Colors.white70,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  textStyle: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),

            const SizedBox(height: 12),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: selectedSymptoms.isEmpty
                    ? null
                    : () {
                        setState(() {
                          _currentStep = 0;
                        });
                      },
                label: const Text('Edit report'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.grey.shade200,
                  disabledBackgroundColor: const Color(0xFF87ABFB),
                  foregroundColor: Colors.black87,
                  disabledForegroundColor: Colors.white70,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  textStyle: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _fourthStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        SizedBox(height: 72),
        // Checkmark icon
        Container(
          width: 80,
          height: 80,
          margin: EdgeInsets.only(bottom: 16),
          decoration: BoxDecoration(
            color: Colors.green[100],
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Icon(
              LucideIcons.circleCheckBig,
              color: Colors.green[600],
              size: 48,
            ),
          ),
        ),

        // Report submitted message
        Column(
          children: [
            Text(
              'Report Submitted',
              style: GoogleFonts.inter(
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            SizedBox(height: 8),
            Text(
              'Thank you for helping the city monitor food-related illness signals.',
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(fontSize: 14, color: Colors.grey[600]),
            ),
          ],
        ),

        SizedBox(height: 48),

        // Done button
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: () {
              Navigator.pushReplacement(
                context,
                MaterialPageRoute(builder: (context) => ReportHistoryScreen()),
              );
            },
            label: const Text('View reports'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2563EB),
              foregroundColor: Colors.white,
              elevation: 0,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              textStyle: GoogleFonts.inter(
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
        SizedBox(height: 12),

        // Done button
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: () {
              Navigator.pop(context);
            },
            label: const Text('Done'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: Color(0xFF2563EB),
              elevation: 0,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              side: BorderSide(color: Color(0xFF2563EB)),
              textStyle: GoogleFonts.inter(
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget dropdownButton({
    required String? initialSelection,
    required String hintText,
    required List<String> dropdownMenuEntries,
    required ValueChanged<String?> onSelected,
  }) {
    return Theme(
      data: Theme.of(context).copyWith(
        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
        visualDensity: VisualDensity.compact,
      ),
      child: DropdownMenu<String>(
        initialSelection: initialSelection,
        onSelected: onSelected,

        width: double.infinity,

        hintText: hintText,

        trailingIcon: Icon(Icons.keyboard_arrow_down, color: Colors.grey),

        textStyle: GoogleFonts.inter(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: Colors.black87,
        ),

        menuStyle: MenuStyle(
          backgroundColor: WidgetStatePropertyAll(Colors.white),
          maximumSize: const WidgetStatePropertyAll(Size(double.infinity, 280)),
          shape: WidgetStatePropertyAll(
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),

        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,

          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 14,
          ),

          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
          ),

          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
          ),

          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: Color(0xFF2563EB), width: 2),
          ),
        ),

        dropdownMenuEntries: dropdownMenuEntries.map((entry) {
          return DropdownMenuEntry(
            value: entry,
            label: entry,
            labelWidget: Text(
              entry,
              style: GoogleFonts.inter(
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}
