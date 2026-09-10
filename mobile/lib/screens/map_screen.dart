import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../services/location_service.dart';

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

  static const double _facilitiesInitialSize = 0.30;
  static const double _facilitiesMinSize = 0.18;
  static const double _facilitiesMaxSize = 0.72;

  static const LatLng _manilaCenter = LatLng(14.5995, 120.9842);

  // ----------------------------------------------------------
  // MOCK FACILITY DATA
  // ----------------------------------------------------------

  final List<Facility> _facilities = [
    // ==========================================================
    // CITY HOSPITALS
    // ==========================================================
    Facility(
      name: 'Ospital ng Maynila Medical Center',
      type: FacilityType.hospital,
      address: 'Quirino Avenue, Malate, Manila',
      location: LatLng(
        14.563728,
        120.986393,
      ), // verified via OSM Overpass (confirms Wikipedia value)
      physicianInCharge: 'Dr. Grace H. Padilla',
      designation: 'Officer-In-Charge / Hospital Director',
      contactNumber: '(02) 8524 6063',
    ),

    Facility(
      name: 'Ospital ng Sampaloc',
      type: FacilityType.hospital,
      address: 'Sampaloc, Manila',
      location: LatLng(
        14.607841,
        120.996718,
      ), // verified via OSM Overpass (confirms prior value)
      physicianInCharge: 'Dr. Angel Erich R. Sison',
      designation: 'Hospital Director',
      contactNumber: '0916 253 2008',
    ),

    Facility(
      name: 'Ospital ng Tondo',
      type: FacilityType.hospital,
      address: 'Jose Abad Santos Avenue, Tondo, Manila',
      location: LatLng(
        14.625580,
        120.978655,
      ), // verified via OSM Overpass (complex has multiple mapped buildings ~14.6251–14.6260, 120.9783–120.9792; this is their center — notably different from prior geocode, trust this one)
      physicianInCharge: 'Dr. Edwin C. Perez',
      designation: 'Officer-In-Charge / Hospital Director',
      contactNumber: '(02) 8251 9402',
    ),

    Facility(
      name: 'Gat. Andres Bonifacio Medical Center',
      type: FacilityType.hospital,
      address: 'Tondo, Manila',
      location: LatLng(
        14.600102,
        120.964791,
      ), // geocoded via Nominatim; not found as a POI in OSM (confirmed after retry) — best available estimate inaccurate said by me
      physicianInCharge: 'Dr. Karl Oliver Laqui',
      designation: 'Hospital Director',
      contactNumber: '(02) 8243 8845',
    ),

    Facility(
      name: 'Sta. Ana Hospital',
      type: FacilityType.hospital,
      address: 'New Panaderos Street, Sta. Ana, Manila',
      location: LatLng(14.58344, 121.01640), // verified via Wikipedia
      physicianInCharge: 'Dr. Janet del Mundo-Tan',
      designation: 'Hospital Director',
      contactNumber: '(02) 8516 6151',
    ),

    Facility(
      name: 'Justice Abad Santos General Hospital',
      type: FacilityType.hospital,
      address: 'Manila',
      location: LatLng(14.597435, 120.972014), // verified via OpenStreetMap
      physicianInCharge: 'Dr. Teodoro E. Martin',
      designation: 'Hospital Director',
      contactNumber: '(02) 8353 6995',
    ),

    // ==========================================================
    // HEALTH DISTRICT I
    // ==========================================================
    Facility(
      name: 'Tondo Foreshore Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District I',
      address: 'Pacheco St. cor. Sta. Fe, Tondo',
      location: LatLng(
        14.6170,
        120.9635,
      ), // UNVERIFIED — not mapped as a POI in OSM (confirmed after retry); rough placeholder only
      physicianInCharge: 'Dr. Marie Paz Custodio',
      email: 'tondoforeshorehc@gmail.com',
    ),

    Facility(
      name: 'Aurora Quezon Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District I',
      address: '459 Francisco St., Tondo',
      location: LatLng(
        14.616667,
        120.969521,
      ), // geocoded via Nominatim; not found as a POI in OSM (confirmed after retry) — best available estimate
      physicianInCharge: 'Dr. Lourdes M. Catalan',
      email: 'donaauroraquezonhc@gmail.com',
    ),

    Facility(
      name: 'Bo. Fugoso Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District I',
      address: '971 Lualhati St., Tondo',
      location: LatLng(
        14.603967,
        120.963546,
      ), // geocoded via Nominatim; not found as a POI in OSM (confirmed after retry) — best available estimate
      physicianInCharge: 'Dr. Herwin B. Herrera',
      email: 'bofugosohealthcenter@gmail.com',
    ),

    Facility(
      name: 'Dagupan Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District I',
      address: '324 Mercado St., Tondo',
      location: LatLng(14.613820, 120.973006), // verified via OSM Overpass
      physicianInCharge: 'Dr. Liecel B. Lameyra',
      email: 'dagupanhealthcenter@gmail.com',
    ),

    Facility(
      name: 'J. Posadas Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District I',
      address: 'Brgy. 139 Rodriguez St. cor. Nepa St., Balut, Tondo',
      location: LatLng(
        14.6250,
        120.9615,
      ), // UNVERIFIED — not mapped as a POI in OSM (confirmed after retry); rough placeholder only
      physicianInCharge: 'Dr. Venus Cortez',
      email: 'juanposadashc2020@gmail.com',
    ),

    Facility(
      name: 'Velasquez Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District I',
      address: 'Nepomuceno cor. F. Varona St., Tondo',
      location: LatLng(
        14.6265,
        120.9670,
      ), // UNVERIFIED — not mapped as a POI in OSM (confirmed after retry); rough placeholder only
      physicianInCharge: 'Dr. Shirley Santos',
      email: 'velasquezhealthcenter2054@gmail.com',
    ),

    Facility(
      name: 'Vitas Health Center & Pharmacy',
      type: FacilityType.healthCenter,
      district: 'Health District I',
      address: 'VIB Compound, Vitas St., Tondo',
      location: LatLng(14.626862, 120.962056), // verified via OSM Overpass
      physicianInCharge: 'Dr. Mary Grace Aquino',
      email: 'mhd.vitas@gmail.com',
    ),

    Facility(
      name: 'Bo. Magsaysay Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District I',
      address: 'Herbosa St., Tondo cor. Maharlika St.',
      location: LatLng(
        14.6275,
        120.9720,
      ), // UNVERIFIED — not mapped as a POI in OSM (confirmed after retry); rough placeholder only
      physicianInCharge: 'Dr. Felito Sampilo',
      email: 'bomag.mhd@gmail.com',
    ),

    Facility(
      name: 'Smokey Mountain Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District I',
      address: 'Brgy. 128 Balut, Tondo Permanent Housing',
      location: LatLng(
        14.634642,
        120.965487,
      ), // geocoded via Nominatim; not found as a POI in OSM (confirmed after retry) — best available estimate
      physicianInCharge: 'Dr. Nhel Eric Gonzales',
      email: 'smokeymthc@gmail.com',
    ),

    Facility(
      name: 'Parola Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District I',
      address: 'PPA Compound, Pier 2, Brgy. 20',
      location: LatLng(
        14.6065,
        120.9630,
      ), // UNVERIFIED — not mapped as a POI in OSM (confirmed after retry); rough placeholder only
      physicianInCharge: 'Dr. Fritz Marasigan',
      email: 'parolahealthcenter2011@gmail.com',
    ),

    // ==========================================================
    // HEALTH DISTRICT II
    // ==========================================================
    Facility(
      name: 'Tondo Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District II',
      address: '2474 Int. Juan Luna St., Tondo',
      location: LatLng(
        14.626629,
        120.973361,
      ), // geocoded via Nominatim; not found as a POI in OSM (confirmed after retry) — best available estimate
      physicianInCharge: 'Dr. Jeanette Begaso',
      email: 'thcmay2021@gmail.com',
    ),

    Facility(
      name: 'Bo. Obrero Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District II',
      address: '3216 Narra St., Tondo',
      location: LatLng(
        14.622049,
        120.977084,
      ), // geocoded via Nominatim; not found as a POI in OSM (confirmed after retry) — best available estimate
      physicianInCharge: 'Dr. Rose Ann B. Benavidez',
      email: 'bo.obrero3216@gmail.com',
    ),

    Facility(
      name: 'Atang Dela Rama Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District II',
      address: '424 Pampanga St., Tondo',
      location: LatLng(14.628977, 120.971722), // verified via OSM Overpass
      physicianInCharge: 'Dr. Arnel Crescini',
      email: 'atangdelaramahealthcenter@gmail.com',
    ),

    Facility(
      name: 'Tayabas Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District II',
      address: '2221 Molave cor. Batangas St.',
      location: LatLng(14.621479, 120.975977), // verified via OSM Overpass
      physicianInCharge: 'Dr. Adora Alcaraz',
      email: 'tayabashc@gmail.com',
    ),

    Facility(
      name: 'Palomar Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District II',
      address: '1103 C.M. Recto',
      location: LatLng(
        14.605933,
        120.975783,
      ), // verified via OSM Overpass (notably different from prior geocode — trust this one)
      physicianInCharge: 'Dr. Maria Cristina Celi',
      email: 'palomarhealthcenter@gmail.com',
    ),

    // ==========================================================
    // HEALTH DISTRICT III
    // ==========================================================
    Facility(
      name: 'F. Lanuza Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District III',
      address: 'T. Alonzo H.S., Sta. Cruz',
      location: LatLng(
        14.6095,
        120.9785,
      ), // UNVERIFIED — not mapped as a POI in OSM (confirmed after retry); rough placeholder only
      physicianInCharge: 'Dr. Elmer D. Ulanday',
      email: 'flanuzahc@gmail.com',
    ),

    Facility(
      name: 'Dimasalang Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District III',
      address: 'Isagani Santiago cor. Sta. Cruz',
      location: LatLng(
        14.6115,
        120.9840,
      ), // UNVERIFIED — not mapped as a POI in OSM (confirmed after retry); rough placeholder only
      physicianInCharge: 'Dr. Cesar R. Follosco',
      email: 'dimasalanghc@gmail.com',
    ),

    Facility(
      name: 'San Nicolas Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District III',
      address: '521 Asuncion St., Binondo',
      location: LatLng(14.598890, 120.970694), // verified via OSM Overpass
      physicianInCharge: 'Dr. Maria Agnes L. Paderanga',
      email: 'sannicolashealthcenter@yahoo.com',
    ),

    Facility(
      name: 'San Sebastian Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District III',
      address: 'Mabini Elementary School, Quiapo',
      location: LatLng(
        14.601422,
        120.985917,
      ), // geocoded via Nominatim; not found as a POI in OSM (confirmed after retry) — best available estimate
      physicianInCharge: 'Dr. Beverly Juan',
      email: 'ssebastianhc@gmail.com',
    ),

    Facility(
      name: 'Valeriano Fugoso Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District III',
      address: 'A. Lacson St., Sta. Cruz',
      location: LatLng(14.616440, 120.986690), // verified via OSM Overpass
      physicianInCharge: 'Dr. Emily Bonalos',
      email: 'vfugosohc@gmail.com',
    ),

    // ==========================================================
    // HEALTH DISTRICT IV
    // ==========================================================
    Facility(
      name: 'D. Belmonte Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District IV',
      address: '1648 P. Florentino St., Sampaloc Brgy. 476',
      location: LatLng(
        14.611677,
        120.992851,
      ), // geocoded via Nominatim; not found as a POI in OSM (confirmed after retry) — best available estimate
      physicianInCharge: 'Dr. Belinda Laya',
      email: 'belmontehc@gmail.com',
    ),

    Facility(
      name: 'M. Earnshaw Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District IV',
      address: '677 M. Earnshaw St., Sampaloc',
      location: LatLng(
        14.607492,
        120.993261,
      ), // geocoded via Nominatim; not found as a POI in OSM (confirmed after retry) — best available estimate
      physicianInCharge: 'Dr. Maria Cariza Regalado',
      email: 'earnshawhealthcenter@yahoo.com',
    ),

    Facility(
      name: 'Ma. Clara Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District IV',
      address: 'Prudencio / Ma. Clara St., Sampaloc',
      location: LatLng(
        14.6085,
        120.9915,
      ), // UNVERIFIED — not mapped as a POI in OSM (confirmed after retry); rough placeholder only
      physicianInCharge: 'Dr. Gerardo Benitez',
      email: 'mariaclarahc2020@gmail.com',
    ),

    Facility(
      name: 'F. Legarda Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District IV',
      address: '457 E. Quintos St., Sampaloc',
      location: LatLng(14.608805, 121.001233), // verified via OSM Overpass
      physicianInCharge: 'Dr. Rosario Margate',
      email: 'Legardahealthcenter2021@gmail.com',
    ),

    Facility(
      name: 'D. Santiago Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District IV',
      address: '844 D. Santiago St., Sampaloc',
      location: LatLng(
        14.603800,
        121.007071,
      ), // geocoded via Nominatim; not found as a POI in OSM (confirmed after retry) — best available estimate
      physicianInCharge: 'Dr. Joel M. Pilapil',
      email: 'domingosantiagohc@gmail.com',
    ),

    Facility(
      name: 'Calabash Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District IV',
      address: '2111 Sobriedad St., Sampaloc',
      location: LatLng(14.611836, 121.003493), // verified via OSM Overpass
      physicianInCharge: 'Dr. Joan Enaje',
      email: 'calabashealthcenter04@gmail.com',
    ),

    Facility(
      name: 'Dapitan Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District IV',
      address: 'Piy Margal and Instruccion Sts., Sampaloc',
      location: LatLng(14.617396, 120.996500), // verified via OSM Overpass
      physicianInCharge: 'Dr. Paz Gienevieve Herrera',
      email: 'dapitanhc@gmail.com',
    ),

    Facility(
      name: 'Paltoc Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District IV',
      address: 'Pureza and San Jose Sts., Sampaloc',
      location: LatLng(
        14.6020,
        121.0030,
      ), // UNVERIFIED — not mapped as a POI in OSM (confirmed after retry); rough placeholder only
      physicianInCharge: 'Dr. Vita T. Datoon',
      email: 'paltoc2021@gmail.com',
    ),

    Facility(
      name: 'Luzviminda Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District IV',
      address: 'Luzon and Cebu Sts., Sampaloc',
      location: LatLng(
        14.6065,
        121.0050,
      ), // UNVERIFIED — not mapped as a POI in OSM (confirmed after retry); rough placeholder only
      physicianInCharge: 'Dr. Jocelyn Rosal',
      email: 'luzvimindahc@gmail.com',
    ),

    // ==========================================================
    // HEALTH DISTRICT V
    // ==========================================================
    Facility(
      name: 'Rosario Reyes Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District V',
      address: '627 San Andres St., Malate',
      location: LatLng(
        14.569582,
        120.987802,
      ), // verified via OSM Overpass (confirms prior geocode)
      physicianInCharge: 'Dr. Melanie Mateo',
      email: 'rosarioreyeshc@gmail.com',
    ),

    Facility(
      name: 'MC Icasiano Health Center & LIC',
      type: FacilityType.healthCenter,
      district: 'Health District V',
      address: '1806 Pedro Gil St., Paco',
      location: LatLng(
        14.578677,
        120.994871,
      ), // geocoded via Nominatim; not found as a POI in OSM (confirmed after retry) — best available estimate
      physicianInCharge: 'Dr. Allan Purugganan',
      email: 'micasianohc1806@gmail.com',
    ),

    Facility(
      name: 'Paco Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District V',
      address: '1427 Canonigo St., Paco',
      location: LatLng(
        14.582030,
        120.997802,
      ), // verified via OSM Overpass (notably different from prior geocode — trust this one)
      physicianInCharge: 'Dr. Pauline Lecaroz',
      email: 'paco.manila21@gmail.com',
    ),

    Facility(
      name: 'Pedro Gil Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District V',
      address: '1423 A Francisco cor. Perlita St., San Andres Bukid',
      location: LatLng(
        14.5705,
        121.0035,
      ), // UNVERIFIED — not mapped as a POI in OSM (confirmed after retry); rough placeholder only
      physicianInCharge: 'Dr. Rosana Milan',
      email: 'pedrogil1423@gmail.com',
    ),

    Facility(
      name: 'Buhay Mahalaga Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District V',
      address: '2518 Arellano St., San Andres Bukid',
      location: LatLng(
        14.574119,
        121.009530,
      ), // verified via OSM Overpass (notably different from prior geocode — trust this one)
      physicianInCharge: 'Dr. Rhona Austria',
      email: 'bmhealthcenter01062021@gmail.com',
    ),

    Facility(
      name: 'Baseco Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District V',
      address: 'Baseco Compound, Port Area, Manila',
      location: LatLng(
        14.590162,
        120.958010,
      ), // geocoded via Nominatim; not found as a POI in OSM (confirmed after retry) — best available estimate
      physicianInCharge: 'Dr. Alexander Morales',
      email: 'basecohc@gmail.com',
    ),

    Facility(
      name: 'Intramuros Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District V',
      address: '12 Sta. Lucia St., Intramuros, Manila',
      location: LatLng(
        14.590200,
        120.972686,
      ), // geocoded via Nominatim; not found as a POI in OSM (confirmed after retry) — best available estimate
      physicianInCharge: 'Dr. Mohammad Zain Bada',
      email: 'intramuroshc@gmail.com',
    ),

    Facility(
      name: 'San Andres Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District V',
      address: '1313 Wesa St., San Andres',
      location: LatLng(14.573136, 120.998701), // verified via OSM Overpass
      physicianInCharge: 'Dr. Domingo Radovan Jr.',
      email: 'sanandreshc1313@gmail.com',
    ),

    // ==========================================================
    // HEALTH DISTRICT VI
    // ==========================================================
    Facility(
      name: 'San Miguel Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District VI',
      address: '3312 Padilla St., San Miguel',
      location: LatLng(14.592416, 120.990818), // verified via OSM Overpass
      physicianInCharge: 'Dr. Rebecca Arellano',
      email: 'sanmiguelhealthcenter@gmail.com',
    ),

    Facility(
      name: 'Bacood Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District VI',
      address: 'Lakay cor. Dalisay Sts., Sta. Mesa',
      location: LatLng(
        14.5895,
        121.0120,
      ), // UNVERIFIED — not mapped as a POI in OSM (confirmed after retry); rough placeholder only
      physicianInCharge: 'Dr. Restituto Aguilar, Jr.',
      email: 'bacoodhealthcenter@gmail.com',
    ),

    Facility(
      name: 'Esperanza Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District VI',
      address: '286 Teresa St., Old Sta. Mesa',
      location: LatLng(14.600567, 121.012736), // verified via OSM Overpass
      physicianInCharge: 'Dr. Julius P. Manalad',
      email: 'esperanzahealthcenter2000@gmail.com',
    ),

    Facility(
      name: 'I. Mendoza Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District VI',
      address: '2158 Jesus St., Pandacan',
      location: LatLng(
        14.592453,
        121.004561,
      ), // geocoded via Nominatim; not found as a POI in OSM (confirmed after retry) — best available estimate
      physicianInCharge: 'Dr. Maria Charina M. Benedicto',
      email: 'imendozahc@gmail.com',
    ),

    Facility(
      name: 'J. Vicencio Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District VI',
      address: '390 A. Bautista St., Sta. Ana',
      location: LatLng(
        14.5840,
        121.0150,
      ), // UNVERIFIED — not mapped as a POI in OSM (confirmed after retry); rough placeholder only
      physicianInCharge: 'Dr. Lea N. Villas',
      email: 'vicenciohealthcenter@gmail.com',
    ),

    Facility(
      name: 'A.H. Lacson Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District VI',
      address: 'Plaza Hugo, Sta. Ana',
      location: LatLng(14.580846, 121.013618), // verified via OSM Overpass
      physicianInCharge: 'Dr. Ma. Lena Mempin',
      email: 'arseniolacson2021@gmail.com',
    ),

    Facility(
      name: 'Bagong Barangay Health Center',
      type: FacilityType.healthCenter,
      district: 'Health District VI',
      address: 'Brgy. Compound, Zamora St., Pandacan',
      location: LatLng(14.585780, 121.001019), // verified via OSM Overpass
      physicianInCharge: 'Dr. Maripaz Aguilar',
      email: 'bbhc.hc.lic@gmail.com',
    ),
  ];

  // ----------------------------------------------------------
  // LOCATION
  // ----------------------------------------------------------

  @override
  void initState() {
    super.initState();
    _loadLocation();
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
    final facilities = _facilities.where((facility) {
      switch (_selectedFilter) {
        case FacilityFilter.all:
          return true;

        case FacilityFilter.healthCenters:
          return facility.type == FacilityType.healthCenter;

        case FacilityFilter.hospitals:
          return facility.type == FacilityType.hospital;
      }
    }).toList();

    if (_userLocation == null) {
      return facilities;
    }

    facilities.sort((a, b) {
      final distanceA = _distanceInKm(_userLocation!, a.location);

      final distanceB = _distanceInKm(_userLocation!, b.location);

      return distanceA.compareTo(distanceB);
    });

    return facilities;
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

  void _selectFacility(Facility facility) {
    setState(() {
      _selectedFacility = facility;
    });

    if (!_isMapReady) return;

    _mapController.move(facility.location, 15.5);
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
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: Stack(
                children: [
                  _buildMap(),
                  _buildMapControls(),
                  _buildFacilitiesPanel(),
                ],
              ),
            ),
          ],
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
                  'Nearby Health Centers & Hospitals',
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
    if (_isLoadingLocation) {
      return Container(
        color: const Color(0xFFE5E7EB),
        child: const Center(child: CircularProgressIndicator()),
      );
    }

    return FlutterMap(
      mapController: _mapController,
      options: MapOptions(
        initialCenter: _userLocation ?? _manilaCenter,
        initialZoom: 13,
        minZoom: 11,
        maxZoom: 21,
        onMapReady: () {
          _isMapReady = true;
        },
        onTap: (_, __) {
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
          attributions: [TextSourceAttribution('OpenStreetMap contributors')],
        ),
      ],
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
          onTap: () => _selectFacility(facility),
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
        onTap: onTap,
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
        onTap: () => _selectFacility(facility),
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

// ----------------------------------------------------------
// DATA MODELS
// ----------------------------------------------------------

enum FacilityType { healthCenter, hospital }

enum FacilityFilter { all, healthCenters, hospitals }

class Facility {
  final String name;
  final FacilityType type;
  final String address;
  final LatLng location;

  final String? district;
  final String? physicianInCharge;
  final String? designation;
  final String? contactNumber;
  final String? email;

  const Facility({
    required this.name,
    required this.type,
    required this.address,
    required this.location,
    this.district,
    this.physicianInCharge,
    this.designation,
    this.contactNumber,
    this.email,
  });
}
