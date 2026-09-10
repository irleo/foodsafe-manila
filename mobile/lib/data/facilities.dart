import 'package:latlong2/latlong.dart';

import '../models/facility.dart';
// ----------------------------------------------------------
// MOCK FACILITY DATA
// ----------------------------------------------------------

final List<Facility> facilities = [
  // ==========================================================
  // CITY HOSPITALS
  // ==========================================================
  Facility(
    name: 'Ospital ng Maynila Medical Center',
    type: FacilityType.hospital,
    address: 'Quirino Avenue, Malate, Manila',
    location: LatLng(14.563728, 120.986393), // verified via OSM Overpass (confirms Wikipedia value)
    physicianInCharge: 'Dr. Grace H. Padilla',
    designation: 'Officer-In-Charge / Hospital Director',
    contactNumber: '(02) 8524 6063',
  ),

  Facility(
    name: 'Ospital ng Sampaloc',
    type: FacilityType.hospital,
    address: 'Sampaloc, Manila',
    location: LatLng(14.607841, 120.996718), // verified via OSM Overpass (confirms prior value)
    physicianInCharge: 'Dr. Angel Erich R. Sison',
    designation: 'Hospital Director',
    contactNumber: '0916 253 2008',
  ),

  Facility(
    name: 'Ospital ng Tondo',
    type: FacilityType.hospital,
    address: 'Jose Abad Santos Avenue, Tondo, Manila',
    location: LatLng(14.625995, 120.978306), // verified via OSM Overpass (amenity=hospital building, confirmed directly — prior average was skewed by a same-named bus stop)
    physicianInCharge: 'Dr. Edwin C. Perez',
    designation: 'Officer-In-Charge / Hospital Director',
    contactNumber: '(02) 8251 9402',
  ),

  Facility(
    name: 'Gat. Andres Bonifacio Medical Center',
    type: FacilityType.hospital,
    address: 'Tondo, Manila',
    location: LatLng(14.601099, 120.964884), // verified via OSM Overpass (amenity=hospital, address 924 Delpan St.)
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
    location: LatLng(14.614365749262085, 120.96085270495948), // user-verified via map tap
    physicianInCharge: 'Dr. Marie Paz Custodio',
    email: 'tondoforeshorehc@gmail.com',
  ),

  Facility(
    name: 'Aurora Quezon Health Center',
    type: FacilityType.healthCenter,
    district: 'Health District I',
    address: '459 Francisco St., Tondo',
    location: LatLng(14.617450486573837, 120.9671589142742), // user-verified via map tap
    physicianInCharge: 'Dr. Lourdes M. Catalan',
    email: 'donaauroraquezonhc@gmail.com',
  ),

  Facility(
    name: 'Bo. Fugoso Health Center',
    type: FacilityType.healthCenter,
    district: 'Health District I',
    address: '971 Lualhati St., Tondo',
    location: LatLng(14.603579106221455, 120.96357749214866), // user-verified via map tap
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
    location: LatLng(14.631067858431315, 120.96754202491248), // user-verified via map tap
    physicianInCharge: 'Dr. Venus Cortez',
    email: 'juanposadashc2020@gmail.com',
  ),

  Facility(
    name: 'Velasquez Health Center',
    type: FacilityType.healthCenter,
    district: 'Health District I',
    address: 'Nepomuceno cor. F. Varona St., Tondo',
    location: LatLng(14.621324068818604, 120.96475557013501), // user-verified via map tap
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
    location: LatLng(14.618371675968099, 120.9649037284505), // user-verified via map tap — NOTE: sources indicate this facility is permanently closed
    physicianInCharge: 'Dr. Felito Sampilo',
    email: 'bomag.mhd@gmail.com',
  ),

  Facility(
    name: 'Smokey Mountain Health Center',
    type: FacilityType.healthCenter,
    district: 'Health District I',
    address: 'Brgy. 128 Balut, Tondo Permanent Housing',
    location: LatLng(14.632613074952564, 120.96222954686846), // user-verified via map tap
    physicianInCharge: 'Dr. Nhel Eric Gonzales',
    email: 'smokeymthc@gmail.com',
  ),

  Facility(
    name: 'Parola Health Center',
    type: FacilityType.healthCenter,
    district: 'Health District I',
    address: 'PPA Compound, Pier 2, Brgy. 20',
    location: LatLng(14.599935725944894, 120.96137968478297), // user-verified via map tap
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
    location: LatLng(14.62087495836395, 120.97169363209699), // user-verified via map tap
    physicianInCharge: 'Dr. Jeanette Begaso',
    email: 'thcmay2021@gmail.com',
  ),

  Facility(
    name: 'Bo. Obrero Health Center',
    type: FacilityType.healthCenter,
    district: 'Health District II',
    address: '3216 Narra St., Tondo',
    location: LatLng(14.634484020132568, 120.9789503939937), // user-verified via map tap (confirmed present on OSM)
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
    location: LatLng(14.605933, 120.975783), // verified via OSM Overpass (notably different from prior geocode — trust this one)
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
    location: LatLng(14.61244333647257, 120.98149615212223), // user-verified via map tap
    physicianInCharge: 'Dr. Elmer D. Ulanday',
    email: 'flanuzahc@gmail.com',
  ),

  Facility(
    name: 'Dimasalang Health Center',
    type: FacilityType.healthCenter,
    district: 'Health District III',
    address: 'Isagani Santiago cor. Sta. Cruz',
    location: LatLng(14.622544599754145, 120.98747328492496), // user-verified via map tap
    physicianInCharge: 'Dr. Cesar R. Follosco',
    email: 'dimasalanghc@gmail.com',
  ),

  Facility(
    name: 'San Nicolas Health Center',
    type: FacilityType.healthCenter,
    district: 'Health District III',
    address: '521 Asuncion St., Binondo',
    location: LatLng(14.598890, 120.970694), // user-confirmed correct on map (OSM feature exists but its name label doesn't display)
    physicianInCharge: 'Dr. Maria Agnes L. Paderanga',
    email: 'sannicolashealthcenter@yahoo.com',
  ),

  Facility(
    name: 'San Sebastian Health Center',
    type: FacilityType.healthCenter,
    district: 'Health District III',
    address: 'Mabini Elementary School, Quiapo',
    location: LatLng(14.601422, 120.985917), // user-confirmed accurate on map
    physicianInCharge: 'Dr. Beverly Juan',
    email: 'ssebastianhc@gmail.com',
  ),

  Facility(
    name: 'Valeriano Fugoso Health Center',
    type: FacilityType.healthCenter,
    district: 'Health District III',
    address: 'A. Lacson St., Sta. Cruz',
    location: LatLng(14.616440, 120.986690), // user-confirmed correct on map (OSM feature exists but its name label doesn't display)
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
    location: LatLng(14.611677, 120.992851), // user-confirmed accurate on map
    physicianInCharge: 'Dr. Belinda Laya',
    email: 'belmontehc@gmail.com',
  ),

  Facility(
    name: 'M. Earnshaw Health Center',
    type: FacilityType.healthCenter,
    district: 'Health District IV',
    address: '677 M. Earnshaw St., Sampaloc',
    location: LatLng(14.605957482666959, 120.99302564595942), // user-verified via map tap
    physicianInCharge: 'Dr. Maria Cariza Regalado',
    email: 'earnshawhealthcenter@yahoo.com',
  ),

  Facility(
    name: 'Ma. Clara Health Center',
    type: FacilityType.healthCenter,
    district: 'Health District IV',
    address: 'Prudencio / Ma. Clara St., Sampaloc',
    location: LatLng(14.618012416456203, 120.99072063848601), // user-verified via map tap
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
    location: LatLng(14.604761077221072, 121.00542155671643), // user-verified via map tap
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
    location: LatLng(14.604964671010531, 121.00305613951879), // user-verified via map tap
    physicianInCharge: 'Dr. Vita T. Datoon',
    email: 'paltoc2021@gmail.com',
  ),

  Facility(
    name: 'Luzviminda Health Center',
    type: FacilityType.healthCenter,
    district: 'Health District IV',
    address: 'Luzon and Cebu Sts., Sampaloc',
    location: LatLng(14.610639320270842, 121.0072402320002), // user-verified via map tap
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
    location: LatLng(14.569582, 120.987802), // verified via OSM Overpass (confirms prior geocode)
    physicianInCharge: 'Dr. Melanie Mateo',
    email: 'rosarioreyeshc@gmail.com',
  ),

  Facility(
    name: 'MC Icasiano Health Center & LIC',
    type: FacilityType.healthCenter,
    district: 'Health District V',
    address: '1806 Pedro Gil St., Paco',
    location: LatLng(14.579162266590624, 121.0039808699615), // user-verified via map tap
    physicianInCharge: 'Dr. Allan Purugganan',
    email: 'micasianohc1806@gmail.com',
  ),

  Facility(
    name: 'Paco Health Center',
    type: FacilityType.healthCenter,
    district: 'Health District V',
    address: '1427 Canonigo St., Paco',
    location: LatLng(14.582030, 120.997802), // verified via OSM Overpass (notably different from prior geocode — trust this one)
    physicianInCharge: 'Dr. Pauline Lecaroz',
    email: 'paco.manila21@gmail.com',
  ),

  Facility(
    name: 'Pedro Gil Health Center',
    type: FacilityType.healthCenter,
    district: 'Health District V',
    address: '1423 A Francisco cor. Perlita St., San Andres Bukid',
    location: LatLng(14.571664679099593, 121.00063596123672), // user-verified via map tap
    physicianInCharge: 'Dr. Rosana Milan',
    email: 'pedrogil1423@gmail.com',
  ),

  Facility(
    name: 'Buhay Mahalaga Health Center',
    type: FacilityType.healthCenter,
    district: 'Health District V',
    address: '2518 Arellano St., San Andres Bukid',
    location: LatLng(14.574119, 121.009530), // verified via OSM Overpass (notably different from prior geocode — trust this one)
    physicianInCharge: 'Dr. Rhona Austria',
    email: 'bmhealthcenter01062021@gmail.com',
  ),

  Facility(
    name: 'Baseco Health Center',
    type: FacilityType.healthCenter,
    district: 'Health District V',
    address: 'Baseco Compound, Port Area, Manila',
    location: LatLng(14.59329126472046, 120.96139293005011), // user-verified via map tap
    physicianInCharge: 'Dr. Alexander Morales',
    email: 'basecohc@gmail.com',
  ),

  Facility(
    name: 'Intramuros Health Center',
    type: FacilityType.healthCenter,
    district: 'Health District V',
    address: '12 Sta. Lucia St., Intramuros, Manila',
    location: LatLng(14.588526974381253, 120.97376910822277), // user-verified via map tap
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
    location: LatLng(14.590284266939552, 121.01769850137092), // user-verified via map tap
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
    location: LatLng(14.592453, 121.004561), // user-confirmed accurate on map
    physicianInCharge: 'Dr. Maria Charina M. Benedicto',
    email: 'imendozahc@gmail.com',
  ),

  Facility(
    name: 'J. Vicencio Health Center',
    type: FacilityType.healthCenter,
    district: 'Health District VI',
    address: '390 A. Bautista St., Sta. Ana',
    location: LatLng(14.587702938323838, 121.01937676241378), // user-verified via map tap
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
