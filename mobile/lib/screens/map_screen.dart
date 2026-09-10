import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../data/facilities.dart';
import '../models/facility.dart';
import '../services/location_service.dart';
import '../widgets/snackbar_widgets.dart';

class MapScreen extends StatefulWidget {
  final VoidCallback? onBackPressed;

  const MapScreen({super.key, this.onBackPressed});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final MapController _mapController = MapController();
  bool _isMapReady = false;

  LatLng? _userLocation;

  bool _isLoadingLocation = true;

  Facility? _selectedFacility;

  FacilityFilter _selectedFilter = FacilityFilter.all;

  final DraggableScrollableController _facilitiesController =
      DraggableScrollableController();

  static const double _facilitiesInitialSize = 0.275;
  static const double _facilitiesMinSize = 0.15;
  static const double _facilitiesMaxSize = 0.72;

  static const LatLng _manilaCenter = LatLng(14.5995, 120.9842);

  List<Facility> get _facilities => facilities;

  final TextEditingController _searchController = TextEditingController();

  String _searchQuery = '';

  void _unfocusSearch() {
    FocusManager.instance.primaryFocus?.unfocus();
  }

  // ----------------------------------------------------------
  // LOCATION
  // ----------------------------------------------------------

  @override
  void initState() {
    super.initState();
    _loadLocation();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _facilitiesController.dispose();
    super.dispose();
  }

  Future<void> _loadLocation() async {
    try {
      final coordinates = await LocationService.getCurrentCoordinates();

      if (!mounted) return;

      if (coordinates != null &&
          coordinates['lat'] != null &&
          coordinates['lng'] != null) {
        final lat = coordinates['lat']!;
        final lng = coordinates['lng']!;

        setState(() {
          _userLocation = LatLng(lat, lng);
          _isLoadingLocation = false;
        });
      } else {
        setState(() {
          _isLoadingLocation = false;
        });
      }
    } catch (_) {
      if (!mounted) return;

      setState(() {
        _isLoadingLocation = false;
      });
    }
  }

  // ----------------------------------------------------------
  // FILTERING
  // ----------------------------------------------------------

  List<Facility> get _filteredFacilities {
    final query = _searchQuery.trim().toLowerCase();

    final filtered = _facilities.where((facility) {
      // Type filter
      switch (_selectedFilter) {
        case FacilityFilter.all:
          break;

        case FacilityFilter.healthCenters:
          if (facility.type != FacilityType.healthCenter) {
            return false;
          }
          break;

        case FacilityFilter.hospitals:
          if (facility.type != FacilityType.hospital) {
            return false;
          }
          break;
      }

      // Search filter
      if (query.isEmpty) {
        return true;
      }

      final name = facility.name.toLowerCase();
      final address = facility.address.toLowerCase();
      final district = facility.district?.toLowerCase() ?? '';

      final type = facility.type == FacilityType.hospital
          ? 'hospital'
          : 'health center';

      return name.contains(query) ||
          address.contains(query) ||
          district.contains(query) ||
          type.contains(query);
    }).toList();

    if (_userLocation == null) {
      return filtered;
    }

    filtered.sort((a, b) {
      final distanceA = _distanceInKm(_userLocation!, a.location);
      final distanceB = _distanceInKm(_userLocation!, b.location);

      return distanceA.compareTo(distanceB);
    });

    return filtered;
  }

  // ----------------------------------------------------------
  // DISTANCE
  // ----------------------------------------------------------

  double _distanceInKm(LatLng a, LatLng b) {
    const earthRadius = 6371.0;

    final lat1 = a.latitude * math.pi / 180;
    final lat2 = b.latitude * math.pi / 180;

    final deltaLat = (b.latitude - a.latitude) * math.pi / 180;

    final deltaLng = (b.longitude - a.longitude) * math.pi / 180;

    final h =
        math.sin(deltaLat / 2) * math.sin(deltaLat / 2) +
        math.cos(lat1) *
            math.cos(lat2) *
            math.sin(deltaLng / 2) *
            math.sin(deltaLng / 2);

    final c = 2 * math.atan2(math.sqrt(h), math.sqrt(1 - h));

    return earthRadius * c;
  }

  String _distanceText(Facility facility) {
    if (_userLocation == null) {
      return 'Nearby';
    }

    final distance = _distanceInKm(_userLocation!, facility.location);

    if (distance < 1) {
      return '${(distance * 1000).round()} m away';
    }

    return '${distance.toStringAsFixed(1)} km away';
  }

  // ----------------------------------------------------------
  // MAP ACTIONS
  // ----------------------------------------------------------

  Future<void> _selectFacility(
    Facility facility, {
    bool showDetails = false,
  }) async {
    setState(() {
      _selectedFacility = facility;
    });

    if (_isMapReady) {
      _mapController.move(facility.location, 15.5);
    }

    if (showDetails) {
      await _showFacilityDetails(facility);
    }
  }

  void _recenter() {
    if (!_isMapReady) return;

    final location = _userLocation;

    _mapController.move(location ?? _manilaCenter, location == null ? 13 : 14);
  }

  // ----------------------------------------------------------
  // BUILD
  // ----------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      resizeToAvoidBottomInset: false,
      body: GestureDetector(
        behavior: HitTestBehavior.translucent,
        onTap: _unfocusSearch,
        child: SafeArea(
          top: true,
          bottom: true,
          child: Column(
            children: [
              _buildHeader(),
              Expanded(
                child: Stack(
                  children: [
                    _buildMap(),
                    _buildSearchBar(),
                    _buildMapControls(),
                    _buildFacilitiesPanel(),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ----------------------------------------------------------
  // HEADER
  // ----------------------------------------------------------

  Widget _buildHeader() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 18),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF2563EB), Color(0xFF1D4ED8)],
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: Row(
        children: [
          Material(
            color: Colors.white.withValues(alpha: 0.16),
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: widget.onBackPressed ?? () => Navigator.pop(context),
              child: const Padding(
                padding: EdgeInsets.all(10),
                child: Icon(
                  LucideIcons.arrowLeft,
                  color: Colors.white,
                  size: 21,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Nearby Facilities',
                  style: GoogleFonts.inter(
                    color: Colors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    const Icon(
                      LucideIcons.mapPin,
                      color: Color(0xFFDBEAFE),
                      size: 13,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      'Manila',
                      style: GoogleFonts.inter(
                        color: const Color(0xFFDBEAFE),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
            ),
            child: Row(
              children: [
                const Icon(LucideIcons.hospital, color: Colors.white, size: 15),
                const SizedBox(width: 5),
                Text(
                  '${_filteredFacilities.length}',
                  style: GoogleFonts.inter(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
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
  // MAP
  // ----------------------------------------------------------

  Widget _buildMap() {
    return Stack(
      children: [
        FlutterMap(
          mapController: _mapController,
          options: MapOptions(
            initialCenter: _userLocation ?? _manilaCenter,
            initialZoom: 13,
            minZoom: 11,
            maxZoom: 22,
            onMapReady: () {
              _isMapReady = true;
            },
            onTap: (tapPosition, point) {
              _unfocusSearch();

              if (_selectedFacility != null) {
                setState(() {
                  _selectedFacility = null;
                });
              }
            },
          ),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'com.example.foodsafe_manila',
            ),

            MarkerLayer(
              markers: [
                ..._buildFacilityMarkers(),

                if (_userLocation != null)
                  Marker(
                    point: _userLocation!,
                    width: 54,
                    height: 54,
                    child: _buildUserMarker(),
                  ),
              ],
            ),

            RichAttributionWidget(
              attributions: [
                TextSourceAttribution('OpenStreetMap contributors'),
              ],
            ),
          ],
        ),

        if (_isLoadingLocation)
          Positioned.fill(
            child: Container(
              color: Colors.white.withValues(alpha: 0.78),
              child: _buildMapLoading(),
            ),
          ),
      ],
    );
  }

  Widget _buildMapLoading() {
    return Center(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: const [
            BoxShadow(
              color: Color(0x18000000),
              blurRadius: 14,
              offset: Offset(0, 4),
            ),
          ],
          border: Border.all(color: Color(0xFFE5E7EB)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(
                strokeWidth: 2.5,
                valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF2563EB)),
              ),
            ),

            const SizedBox(width: 12),

            Text(
              'Getting your location...',
              style: GoogleFonts.inter(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF374151),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchBar() {
    return Positioned(
      top: 16,
      left: 16,
      right: 72,
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        elevation: 3,
        shadowColor: Colors.black.withValues(alpha: 0.15),
        child: TextField(
          controller: _searchController,
          onChanged: (value) {
            setState(() {
              _searchQuery = value;

              if (_selectedFacility != null &&
                  !_filteredFacilities.contains(_selectedFacility)) {
                _selectedFacility = null;
              }
            });
          },
          style: GoogleFonts.inter(
            fontSize: 13,
            color: const Color(0xFF111827),
          ),
          decoration: InputDecoration(
            hintText: 'Search facilities...',
            hintStyle: GoogleFonts.inter(
              fontSize: 13,
              color: const Color(0xFF9CA3AF),
            ),
            prefixIcon: const Icon(
              LucideIcons.search,
              size: 19,
              color: Color(0xFF6B7280),
            ),
            suffixIcon: _searchQuery.isNotEmpty
                ? IconButton(
                    icon: const Icon(
                      LucideIcons.x,
                      size: 18,
                      color: Color(0xFF6B7280),
                    ),
                    onPressed: () {
                      _searchController.clear();

                      setState(() {
                        _searchQuery = '';
                        _selectedFacility = null;
                      });
                    },
                  )
                : null,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide.none,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(
                color: Color(0xFF2563EB),
                width: 1.2,
              ),
            ),
            filled: true,
            fillColor: Colors.white,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 14,
              vertical: 13,
            ),
          ),
        ),
      ),
    );
  }

  // ----------------------------------------------------------
  // FACILITY MARKERS
  // ----------------------------------------------------------

  List<Marker> _buildFacilityMarkers() {
    return _filteredFacilities.map((facility) {
      final isSelected = _selectedFacility == facility;

      final markerColor = facility.type == FacilityType.hospital
          ? const Color(0xFF2563EB)
          : const Color(0xFF0D9488);

      return Marker(
        point: facility.location,
        width: 50,
        height: 58,
        child: GestureDetector(
          onTap: () {
            _unfocusSearch();
            _selectFacility(facility, showDetails: true);
          },
          child: AnimatedScale(
            scale: isSelected ? 1.15 : 1,
            duration: const Duration(milliseconds: 180),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: isSelected ? 42 : 36,
                  height: isSelected ? 42 : 36,
                  decoration: BoxDecoration(
                    color: markerColor,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 3),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x30000000),
                        blurRadius: 6,
                        offset: Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Icon(
                    facility.type == FacilityType.hospital
                        ? LucideIcons.hospital
                        : LucideIcons.stethoscope,
                    color: Colors.white,
                    size: isSelected ? 21 : 18,
                  ),
                ),

                Transform.translate(
                  offset: const Offset(0, -5),
                  child: Transform.rotate(
                    angle: math.pi / 4,
                    child: Container(
                      width: 9,
                      height: 9,
                      decoration: BoxDecoration(
                        color: markerColor,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }).toList();
  }

  // ----------------------------------------------------------
  // USER MARKER
  // ----------------------------------------------------------

  Widget _buildUserMarker() {
    return Stack(
      alignment: Alignment.center,
      children: [
        Container(
          width: 54,
          height: 54,
          decoration: BoxDecoration(
            color: const Color(0x332563EB),
            shape: BoxShape.circle,
          ),
        ),

        Container(
          width: 19,
          height: 19,
          decoration: BoxDecoration(
            color: const Color(0xFF2563EB),
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 3),
            boxShadow: const [
              BoxShadow(color: Color(0x40000000), blurRadius: 5),
            ],
          ),
        ),
      ],
    );
  }

  // ----------------------------------------------------------
  // MAP CONTROLS
  // ----------------------------------------------------------

  Widget _buildMapControls() {
    return Positioned(
      top: 16,
      right: 16,
      child: Column(
        children: [
          _mapControlButton(icon: LucideIcons.locateFixed, onTap: _recenter),

          const SizedBox(height: 8),

          _mapControlButton(
            icon: LucideIcons.plus,
            onTap: () {
              if (!_isMapReady) return;

              final zoom = _mapController.camera.zoom;

              _mapController.move(_mapController.camera.center, zoom + 1);
            },
          ),

          const SizedBox(height: 6),

          _mapControlButton(
            icon: LucideIcons.minus,
            onTap: () {
              if (!_isMapReady) return;

              final zoom = _mapController.camera.zoom;

              _mapController.move(_mapController.camera.center, zoom - 1);
            },
          ),
        ],
      ),
    );
  }

  Widget _mapControlButton({
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      elevation: 2,
      shadowColor: Colors.black.withValues(alpha: 0.12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () {
          _unfocusSearch();
          onTap();
        },
        child: SizedBox(
          width: 44,
          height: 44,
          child: Icon(icon, size: 20, color: const Color(0xFF374151)),
        ),
      ),
    );
  }

  // ----------------------------------------------------------
  // FACILITY PANEL
  // ----------------------------------------------------------
  void _handleFacilitiesDragUpdate(
    DragUpdateDetails details,
    BuildContext context,
  ) {
    if (!_facilitiesController.isAttached) return;

    final height = MediaQuery.sizeOf(context).height;

    // Increase this to make the sheet respond more aggressively.
    const dragSensitivity = 2.0;

    final sizeDelta = (-details.delta.dy / height) * dragSensitivity;

    final newSize = (_facilitiesController.size + sizeDelta).clamp(
      _facilitiesMinSize,
      _facilitiesMaxSize,
    );

    _facilitiesController.jumpTo(newSize);
  }

  Widget _buildFacilitiesPanel() {
    return DraggableScrollableSheet(
      controller: _facilitiesController,
      initialChildSize: _facilitiesInitialSize,
      minChildSize: _facilitiesMinSize,
      maxChildSize: _facilitiesMaxSize,
      snap: true,
      snapSizes: const [
        _facilitiesMinSize,
        _facilitiesInitialSize,
        _facilitiesMaxSize,
      ],
      builder: (context, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: Color(0xFFF9FAFB),
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            boxShadow: [
              BoxShadow(
                color: Color(0x22000000),
                blurRadius: 16,
                offset: Offset(0, -4),
              ),
            ],
          ),
          child: Column(
            children: [
              // ------------------------------------------------
              // DRAGGABLE / FIXED HEADER AREA
              // ------------------------------------------------
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onVerticalDragUpdate: (details) {
                  _handleFacilitiesDragUpdate(details, context);
                },
                onVerticalDragEnd: (_) {
                  if (!_facilitiesController.isAttached) return;

                  final currentSize = _facilitiesController.size;

                  double target;

                  if (currentSize <
                      (_facilitiesMinSize + _facilitiesInitialSize) / 2) {
                    target = _facilitiesMinSize;
                  } else if (currentSize <
                      (_facilitiesInitialSize + _facilitiesMaxSize) / 2) {
                    target = _facilitiesInitialSize;
                  } else {
                    target = _facilitiesMaxSize;
                  }

                  _facilitiesController.animateTo(
                    target,
                    duration: const Duration(milliseconds: 250),
                    curve: Curves.easeOutCubic,
                  );
                },
                child: Column(
                  children: [
                    const SizedBox(height: 10),

                    // Drag handle
                    Container(
                      width: 38,
                      height: 4,
                      decoration: BoxDecoration(
                        color: const Color(0xFFD1D5DB),
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),

                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Nearby Facilities',
                              style: GoogleFonts.inter(
                                fontSize: 17,
                                fontWeight: FontWeight.w600,
                                color: const Color(0xFF111827),
                              ),
                            ),
                          ),
                          Text(
                            '${_filteredFacilities.length} found',
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              color: const Color(0xFF6B7280),
                            ),
                          ),
                        ],
                      ),
                    ),

                    // ------------------------------------------------
                    // FIXED FILTERS
                    // ------------------------------------------------
                    _buildFilterChips(),

                    const SizedBox(height: 8),
                  ],
                ),
              ),

              // ------------------------------------------------
              // SCROLLABLE FACILITY LIST
              // ------------------------------------------------
              Expanded(
                child: ListView.separated(
                  controller: scrollController,
                  physics: const ClampingScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                  itemCount: _filteredFacilities.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    return _buildFacilityCard(_filteredFacilities[index]);
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  // ----------------------------------------------------------
  // FILTER CHIPS
  // ----------------------------------------------------------

  Widget _buildFilterChips() {
    return SizedBox(
      height: 38,
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        scrollDirection: Axis.horizontal,
        children: [
          _filterChip(
            label: 'All',
            filter: FacilityFilter.all,
            icon: LucideIcons.map,
          ),

          const SizedBox(width: 8),

          _filterChip(
            label: 'Health Centers',
            filter: FacilityFilter.healthCenters,
            icon: LucideIcons.stethoscope,
          ),

          const SizedBox(width: 8),

          _filterChip(
            label: 'Hospitals',
            filter: FacilityFilter.hospitals,
            icon: LucideIcons.hospital,
          ),
        ],
      ),
    );
  }

  Widget _filterChip({
    required String label,
    required FacilityFilter filter,
    required IconData icon,
  }) {
    final selected = _selectedFilter == filter;

    return Material(
      color: selected ? const Color(0xFF2563EB) : Colors.white,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: () {
          _unfocusSearch();

          setState(() {
            _selectedFilter = filter;

            if (_selectedFacility != null &&
                !_filteredFacilities.contains(_selectedFacility)) {
              _selectedFacility = null;
            }
          });
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: selected
                  ? const Color(0xFF2563EB)
                  : const Color(0xFFE5E7EB),
            ),
          ),
          child: Row(
            children: [
              Icon(
                icon,
                size: 15,
                color: selected ? Colors.white : const Color(0xFF6B7280),
              ),

              const SizedBox(width: 6),

              Text(
                label,
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: selected ? Colors.white : const Color(0xFF374151),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ----------------------------------------------------------
  // FACILITY CARD
  // ----------------------------------------------------------

  Widget _buildFacilityCard(Facility facility) {
    final selected = _selectedFacility == facility;

    final accent = facility.type == FacilityType.hospital
        ? const Color(0xFF2563EB)
        : const Color(0xFF0D9488);

    final background = facility.type == FacilityType.hospital
        ? const Color(0xFFEFF6FF)
        : const Color(0xFFF0FDFA);

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () {
          _unfocusSearch();
          _selectFacility(facility, showDetails: true);
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected ? accent : const Color(0xFFF3F4F6),
              width: selected ? 1.4 : 1,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: background,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  facility.type == FacilityType.hospital
                      ? LucideIcons.hospital
                      : LucideIcons.stethoscope,
                  color: accent,
                  size: 21,
                ),
              ),

              const SizedBox(width: 12),

              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      facility.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF111827),
                      ),
                    ),

                    const SizedBox(height: 3),

                    Row(
                      children: [
                        Text(
                          facility.type == FacilityType.hospital
                              ? 'Hospital'
                              : 'Health Center',
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            color: accent,
                            fontWeight: FontWeight.w600,
                          ),
                        ),

                        const SizedBox(width: 6),

                        Container(
                          width: 3,
                          height: 3,
                          decoration: const BoxDecoration(
                            color: Color(0xFFD1D5DB),
                            shape: BoxShape.circle,
                          ),
                        ),

                        const SizedBox(width: 6),

                        Text(
                          _distanceText(facility),
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            color: const Color(0xFF6B7280),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 3),

                    Text(
                      facility.address,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        color: const Color(0xFF9CA3AF),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(width: 8),

              Material(
                color: const Color(0xFFF3F4F6),
                shape: const CircleBorder(),
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: () => _showFacilityDetails(facility),
                  child: const Padding(
                    padding: EdgeInsets.all(8),
                    child: Icon(
                      LucideIcons.chevronRight,
                      color: Color(0xFF6B7280),
                      size: 17,
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

  // ----------------------------------------------------------
  // FACILITY DETAILS
  // ----------------------------------------------------------

  Future<void> _showFacilityDetails(Facility facility) async {
    final accent = facility.type == FacilityType.hospital
        ? const Color(0xFF2563EB)
        : const Color(0xFF0D9488);

    // Lower the nearby facilities sheet first.
    if (_facilitiesController.isAttached) {
      await _facilitiesController.animateTo(
        _facilitiesMinSize,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOutCubic,
      );
    }

    await showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      barrierColor: Colors.black.withValues(alpha: 0.35),
      isScrollControlled: true,
      builder: (context) {
        return SafeArea(
          top: false,
          child: Container(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 5,
                    decoration: BoxDecoration(
                      color: const Color(0xFFE5E7EB),
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                ),

                const SizedBox(height: 18),

                Row(
                  children: [
                    Container(
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(
                        color: accent.withValues(alpha: 0.10),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Icon(
                        facility.type == FacilityType.hospital
                            ? LucideIcons.hospital
                            : LucideIcons.stethoscope,
                        color: accent,
                        size: 23,
                      ),
                    ),

                    const SizedBox(width: 12),

                    Expanded(
                      child: Text(
                        facility.name,
                        style: GoogleFonts.inter(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF111827),
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

                const SizedBox(height: 18),

                _detailRow(icon: LucideIcons.mapPin, text: facility.address),

                if (facility.district != null) ...[
                  const SizedBox(height: 10),
                  _detailRow(icon: LucideIcons.map, text: facility.district!),
                ],

                if (facility.physicianInCharge != null) ...[
                  const SizedBox(height: 10),
                  _detailRow(
                    icon: LucideIcons.userRound,
                    text: facility.physicianInCharge!,
                  ),
                ],

                if (facility.designation != null) ...[
                  const SizedBox(height: 6),
                  Padding(
                    padding: const EdgeInsets.only(left: 27),
                    child: Text(
                      facility.designation!,
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        color: const Color(0xFF9CA3AF),
                      ),
                    ),
                  ),
                ],

                if (facility.contactNumber != null) ...[
                  const SizedBox(height: 10),
                  _detailRow(
                    icon: LucideIcons.phone,
                    text: facility.contactNumber!,
                  ),
                ],

                if (facility.email != null) ...[
                  const SizedBox(height: 10),
                  _detailRow(icon: LucideIcons.mail, text: facility.email!),
                ],

                const SizedBox(height: 10),

                _detailRow(
                  icon: LucideIcons.navigation,
                  text: _distanceText(facility),
                ),

                const SizedBox(height: 20),

                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      Navigator.pop(context);

                      if (_isMapReady) {
                        _mapController.move(facility.location, 16);
                      }
                    },
                    icon: const Icon(LucideIcons.map, size: 18),
                    label: Text(
                      'View on Map',
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );

    if (mounted && _facilitiesController.isAttached) {
      await _facilitiesController.animateTo(
        _facilitiesInitialSize,
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeOutCubic,
      );
    }
  }

  Widget _detailRow({required IconData icon, required String text}) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 17, color: const Color(0xFF6B7280)),

        const SizedBox(width: 10),

        Expanded(
          child: Text(
            text,
            style: GoogleFonts.inter(
              fontSize: 13,
              height: 1.4,
              color: const Color(0xFF4B5563),
            ),
          ),
        ),
      ],
    );
  }
}
