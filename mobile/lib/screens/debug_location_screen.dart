import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../services/debug_location_service.dart';
import '../services/location_service.dart';
import '../services/manila_geo_service.dart';
import '../utils/format_helpers.dart';
import '../widgets/snackbar_widgets.dart';

/// Debug-only screen to simulate a Manila barangay for testing.
class DebugLocationScreen extends StatefulWidget {
  const DebugLocationScreen({super.key});

  @override
  State<DebugLocationScreen> createState() => _DebugLocationScreenState();
}

class _DebugLocationScreenState extends State<DebugLocationScreen> {
  static const _districts = [
    'District 1',
    'District 2',
    'District 3',
    'District 4',
    'District 5',
    'District 6',
  ];

  bool _enabled = false;
  bool _loading = true;
  String? _district;
  String? _barangayLabel;
  int? _barangayNo;
  List<Map<String, dynamic>> _barangayOptions = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!DebugLocationService.isAvailable) {
      setState(() => _loading = false);
      return;
    }
    await DebugLocationService.ensurePrefsReady();
    await ManilaGeoService.ensureLoaded();
    final enabled = await DebugLocationService.isEnabled();
    final simulated = await DebugLocationService.getSimulatedLocation();
    setState(() {
      _enabled = enabled;
      _district = simulated?.district ?? _districts.first;
      _barangayNo = simulated?.barangayNo;
      if (_district != null) {
        _barangayOptions = ManilaGeoService.barangaysForDistrict(_district!);
        if (_barangayNo != null) {
          final match = _barangayOptions.where(
            (b) => b['barangayNo'] == _barangayNo,
          );
          _barangayLabel =
              match.isNotEmpty ? match.first['label'] as String? : null;
        }
      }
      _loading = false;
    });
  }

  Future<void> _apply() async {
    if (_district == null || _barangayNo == null) {
      SnackbarWidgets.error(context, 'Select a district and barangay');
      return;
    }
    await DebugLocationService.setSimulated(
      district: _district!,
      barangayNo: _barangayNo!,
    );
    await LocationService.clearCache();
    await LocationService.resolveManilaLocation(forceRefresh: true);
    if (!mounted) return;
    SnackbarWidgets.success(context, 'Debug location enabled');
    setState(() => _enabled = true);
  }

  Future<void> _disable() async {
    await DebugLocationService.clear();
    await LocationService.clearCache();
    if (!mounted) return;
    SnackbarWidgets.success(context, 'Using real GPS again');
    setState(() {
      _enabled = false;
      _barangayLabel = null;
      _barangayNo = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!kDebugMode) {
      return Scaffold(
        appBar: AppBar(title: const Text('Debug location')),
        body: const Center(child: Text('Not available in release builds.')),
      );
    }

    final preview = _district != null && _barangayNo != null
        ? FormatHelpers.formatLocationDisplay(
            district: _district!,
            barangayNo: _barangayNo,
          )
        : null;

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        title: Text(
          'Simulate location',
          style: GoogleFonts.inter(fontWeight: FontWeight.w600),
        ),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  'For developers outside Manila. The app will use the selected '
                  'district and barangay for reports, alerts, and location display.',
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    color: const Color(0xFF4B5563),
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 16),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(
                    'Simulated location active',
                    style: GoogleFonts.inter(fontWeight: FontWeight.w600),
                  ),
                  subtitle: Text(
                    _enabled ? 'Debug GPS is on' : 'Using device GPS',
                    style: GoogleFonts.inter(fontSize: 13),
                  ),
                  value: _enabled,
                  onChanged: (on) async {
                    if (on) {
                      await _apply();
                    } else {
                      await _disable();
                    }
                  },
                ),
                const SizedBox(height: 8),
                Text(
                  'District',
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.w500,
                    color: const Color(0xFF374151),
                  ),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  initialValue: _district,
                  decoration: _fieldDecoration(),
                  items: _districts
                      .map((d) => DropdownMenuItem(value: d, child: Text(d)))
                      .toList(),
                  onChanged: (value) {
                    setState(() {
                      _district = value;
                      _barangayOptions = value == null
                          ? []
                          : ManilaGeoService.barangaysForDistrict(value);
                      _barangayLabel = null;
                      _barangayNo = null;
                    });
                  },
                ),
                const SizedBox(height: 16),
                Text(
                  'Barangay',
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.w500,
                    color: const Color(0xFF374151),
                  ),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  initialValue: _barangayLabel,
                  decoration: _fieldDecoration(hint: 'Choose barangay…'),
                  items: _barangayOptions
                      .map(
                        (b) => DropdownMenuItem(
                          value: b['label'] as String,
                          child: Text(b['label'] as String),
                        ),
                      )
                      .toList(),
                  onChanged: (value) {
                    final match = _barangayOptions.where(
                      (b) => b['label'] == value,
                    );
                    setState(() {
                      _barangayLabel = value;
                      _barangayNo =
                          match.isNotEmpty ? match.first['barangayNo'] as int? : null;
                    });
                  },
                ),
                if (preview != null) ...[
                  const SizedBox(height: 20),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFBFDBFE)),
                    ),
                    child: Text(
                      'Preview: $preview',
                      style: GoogleFonts.inter(
                        fontWeight: FontWeight.w500,
                        color: const Color(0xFF1D4ED8),
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: _apply,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      foregroundColor: Colors.white,
                      shape: const StadiumBorder(),
                    ),
                    child: Text(
                      'Apply simulated location',
                      style: GoogleFonts.inter(fontWeight: FontWeight.w600),
                    ),
                  ),
                ),
              ],
            ),
    );
  }

  InputDecoration _fieldDecoration({String? hint}) {
    return InputDecoration(
      hintText: hint,
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
      ),
    );
  }
}