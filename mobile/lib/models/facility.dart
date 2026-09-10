import 'package:latlong2/latlong.dart';
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
