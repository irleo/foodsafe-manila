export const mockReports = [
  // =========================
  // JAN 2025 (adds small spikes)
  // =========================
  { _id: "r001", location: { name: "Quiapo Public Market", district: "Quiapo", coordinates: { lat: 14.5986, lng: 120.9836 } }, illness: "Food Poisoning", severity: "Moderate", reportedAt: "2025-01-03", foodSource: "Street Food" },
  { _id: "r002", location: { name: "Tondo Wet Market", district: "Tondo", coordinates: { lat: 14.6177, lng: 120.9670 } }, illness: "Salmonella", severity: "High", reportedAt: "2025-01-04", foodSource: "Raw Seafood" },
  { _id: "r003", location: { name: "Binondo Restaurant Row", district: "Binondo", coordinates: { lat: 14.6013, lng: 120.9754 } }, illness: "Salmonellosis", severity: "Moderate", reportedAt: "2025-01-05", foodSource: "Restaurant" },

  // Spike day (same date, different areas)
  { _id: "r004", location: { name: "Ermita Street Food", district: "Ermita", coordinates: { lat: 14.5826, lng: 120.9846 } }, illness: "E. coli Infection", severity: "Moderate", reportedAt: "2025-01-06", foodSource: "Contaminated Ice" },
  { _id: "r063", location: { name: "Santa Cruz Carinderia Row", district: "Santa Cruz", coordinates: { lat: 14.6048, lng: 120.9821 } }, illness: "Food Poisoning", severity: "High", reportedAt: "2025-01-06", foodSource: "Reheated Stew" },
  { _id: "r064", location: { name: "Tondo Sidewalk BBQ", district: "Tondo", coordinates: { lat: 14.6168, lng: 120.9686 } }, illness: "Food Poisoning", severity: "Moderate", reportedAt: "2025-01-06", foodSource: "Street BBQ" },
  { _id: "r065", location: { name: "Pandacan Water Refilling Area", district: "Pandacan", coordinates: { lat: 14.5909, lng: 121.0069 } }, illness: "E. coli Infection", severity: "High", reportedAt: "2025-01-06", foodSource: "Water/Ice" },

  { _id: "r005", location: { name: "Malate Night Market", district: "Malate", coordinates: { lat: 14.5700, lng: 120.9850 } }, illness: "Food Poisoning", severity: "High", reportedAt: "2025-01-07", foodSource: "Night Market" },
  { _id: "r006", location: { name: "Paco Food Stalls", district: "Paco", coordinates: { lat: 14.5794, lng: 120.9967 } }, illness: "Norovirus", severity: "Low", reportedAt: "2025-01-08", foodSource: "Handled Food" },
  { _id: "r007", location: { name: "Sampaloc Canteen", district: "Sampaloc", coordinates: { lat: 14.6092, lng: 120.9890 } }, illness: "Norovirus", severity: "Low", reportedAt: "2025-01-10", foodSource: "Cafeteria" },
  { _id: "r008", location: { name: "Intramuros Cafe", district: "Intramuros", coordinates: { lat: 14.5896, lng: 120.9747 } }, illness: "Food Poisoning", severity: "Low", reportedAt: "2025-01-12", foodSource: "Cafe" },

  // Another mini spike
  { _id: "r009", location: { name: "Santa Cruz Food Court", district: "Santa Cruz", coordinates: { lat: 14.6042, lng: 120.9810 } }, illness: "Salmonella", severity: "High", reportedAt: "2025-01-15", foodSource: "Food Court" },
  { _id: "r066", location: { name: "Ermita Convenience Meals", district: "Ermita", coordinates: { lat: 14.5834, lng: 120.9859 } }, illness: "Food Poisoning", severity: "Moderate", reportedAt: "2025-01-15", foodSource: "Packaged Meals" },
  { _id: "r067", location: { name: "Quiapo Fried Snacks Alley", district: "Quiapo", coordinates: { lat: 14.5991, lng: 120.9842 } }, illness: "Food Poisoning", severity: "High", reportedAt: "2025-01-15", foodSource: "Street Food" },

  { _id: "r010", location: { name: "San Miguel Residential", district: "San Miguel", coordinates: { lat: 14.6019, lng: 120.9883 } }, illness: "Food Poisoning", severity: "Moderate", reportedAt: "2025-01-18", foodSource: "Home Prepared" },
  { _id: "r011", location: { name: "Port Area Canteen", district: "Port Area", coordinates: { lat: 14.5903, lng: 120.9639 } }, illness: "Norovirus", severity: "Moderate", reportedAt: "2025-01-20", foodSource: "Workplace Canteen" },
  { _id: "r012", location: { name: "Pandacan Barangay Hall Area", district: "Pandacan", coordinates: { lat: 14.5906, lng: 121.0061 } }, illness: "Food Poisoning", severity: "Low", reportedAt: "2025-01-22", foodSource: "Community Event" },
  { _id: "r013", location: { name: "San Andres Market", district: "San Andres", coordinates: { lat: 14.5669, lng: 120.9976 } }, illness: "E. coli Infection", severity: "High", reportedAt: "2025-01-24", foodSource: "Water/Ice" },
  { _id: "r014", location: { name: "Santa Ana Riverside Stalls", district: "Santa Ana", coordinates: { lat: 14.5760, lng: 121.0050 } }, illness: "Food Poisoning", severity: "Moderate", reportedAt: "2025-01-26", foodSource: "Street Food" },
  { _id: "r015", location: { name: "Quiapo Sidewalk Vendors", district: "Quiapo", coordinates: { lat: 14.5986, lng: 120.9836 } }, illness: "Salmonellosis", severity: "Moderate", reportedAt: "2025-01-28", foodSource: "Street Vendor" },

  // =========================
  // FEB 2025 (adds a medium spike around Feb 12)
  // =========================
  { _id: "r016", location: { name: "Tondo Community Area", district: "Tondo", coordinates: { lat: 14.6177, lng: 120.9670 } }, illness: "Food Poisoning", severity: "High", reportedAt: "2025-02-01", foodSource: "Street Food" },
  { _id: "r017", location: { name: "Binondo Bakery", district: "Binondo", coordinates: { lat: 14.6013, lng: 120.9754 } }, illness: "Food Poisoning", severity: "Low", reportedAt: "2025-02-03", foodSource: "Bakery" },
  { _id: "r018", location: { name: "Ermita Hotel Buffet", district: "Ermita", coordinates: { lat: 14.5826, lng: 120.9846 } }, illness: "Norovirus", severity: "Moderate", reportedAt: "2025-02-05", foodSource: "Buffet" },
  { _id: "r019", location: { name: "Malate Beachside Eatery", district: "Malate", coordinates: { lat: 14.5700, lng: 120.9850 } }, illness: "Salmonella", severity: "High", reportedAt: "2025-02-06", foodSource: "Seafood" },
  { _id: "r020", location: { name: "Paco Public Market", district: "Paco", coordinates: { lat: 14.5794, lng: 120.9967 } }, illness: "E. coli Infection", severity: "Moderate", reportedAt: "2025-02-08", foodSource: "Wet Market" },
  { _id: "r021", location: { name: "Sampaloc Boarding House", district: "Sampaloc", coordinates: { lat: 14.6092, lng: 120.9890 } }, illness: "Food Poisoning", severity: "Low", reportedAt: "2025-02-10", foodSource: "Home Prepared" },

  // Spike day: Feb 12 (same date, different districts)
  { _id: "r022", location: { name: "Santa Cruz Terminal Area", district: "Santa Cruz", coordinates: { lat: 14.6042, lng: 120.9810 } }, illness: "Salmonellosis", severity: "High", reportedAt: "2025-02-12", foodSource: "Fast Food" },
  { _id: "r068", location: { name: "Quiapo Rice Meal Stalls", district: "Quiapo", coordinates: { lat: 14.5977, lng: 120.9844 } }, illness: "Food Poisoning", severity: "High", reportedAt: "2025-02-12", foodSource: "Rice Meals" },
  { _id: "r069", location: { name: "Port Area Packed Lunches", district: "Port Area", coordinates: { lat: 14.5898, lng: 120.9651 } }, illness: "Food Poisoning", severity: "Moderate", reportedAt: "2025-02-12", foodSource: "Packaged Meals" },
  { _id: "r070", location: { name: "Ermita Street Juice Cart", district: "Ermita", coordinates: { lat: 14.5821, lng: 120.9861 } }, illness: "Norovirus", severity: "Moderate", reportedAt: "2025-02-12", foodSource: "Ice/Drinks" },
  { _id: "r071", location: { name: "Tondo Fishball Corner", district: "Tondo", coordinates: { lat: 14.6189, lng: 120.9661 } }, illness: "Food Poisoning", severity: "Moderate", reportedAt: "2025-02-12", foodSource: "Street Food" },
  { _id: "r072", location: { name: "San Andres Pantry Meals", district: "San Andres", coordinates: { lat: 14.5675, lng: 120.9982 } }, illness: "Food Poisoning", severity: "Low", reportedAt: "2025-02-12", foodSource: "Home Prepared" },

  { _id: "r023", location: { name: "Intramuros Tour Cafe", district: "Intramuros", coordinates: { lat: 14.5896, lng: 120.9747 } }, illness: "Norovirus", severity: "Low", reportedAt: "2025-02-14", foodSource: "Cafe" },
  { _id: "r024", location: { name: "San Miguel School Canteen", district: "San Miguel", coordinates: { lat: 14.6019, lng: 120.9883 } }, illness: "Food Poisoning", severity: "Moderate", reportedAt: "2025-02-15", foodSource: "Canteen" },
  { _id: "r025", location: { name: "Port Area Dockside Meals", district: "Port Area", coordinates: { lat: 14.5903, lng: 120.9639 } }, illness: "Salmonella", severity: "High", reportedAt: "2025-02-17", foodSource: "Packaged Meals" },

  // =========================
  // MAR 2025 (adds a medium spike around Mar 06)
  // =========================
  { _id: "r026", location: { name: "Pandacan Community Kitchen", district: "Pandacan", coordinates: { lat: 14.5906, lng: 121.0061 } }, illness: "Food Poisoning", severity: "Moderate", reportedAt: "2025-03-01", foodSource: "Community Event" },
  { _id: "r027", location: { name: "San Andres Food Court", district: "San Andres", coordinates: { lat: 14.5669, lng: 120.9976 } }, illness: "Norovirus", severity: "Moderate", reportedAt: "2025-03-03", foodSource: "Food Court" },
  { _id: "r028", location: { name: "Quiapo Market Lane", district: "Quiapo", coordinates: { lat: 14.5986, lng: 120.9836 } }, illness: "E. coli Infection", severity: "High", reportedAt: "2025-03-05", foodSource: "Water/Ice" },

  // Spike day: Mar 06
  { _id: "r029", location: { name: "Tondo Street Vendors", district: "Tondo", coordinates: { lat: 14.6177, lng: 120.9670 } }, illness: "Food Poisoning", severity: "High", reportedAt: "2025-03-06", foodSource: "Street Vendor" },
  { _id: "r073", location: { name: "Malate Late-Night Sisig Stall", district: "Malate", coordinates: { lat: 14.5691, lng: 120.9862 } }, illness: "Food Poisoning", severity: "High", reportedAt: "2025-03-06", foodSource: "Night Market" },
  { _id: "r074", location: { name: "Santa Ana Riverside BBQ", district: "Santa Ana", coordinates: { lat: 14.5754, lng: 121.0062 } }, illness: "Food Poisoning", severity: "Moderate", reportedAt: "2025-03-06", foodSource: "Street Food" },
  { _id: "r075", location: { name: "Ermita Fried Chicken Stand", district: "Ermita", coordinates: { lat: 14.5819, lng: 120.9841 } }, illness: "Salmonellosis", severity: "High", reportedAt: "2025-03-06", foodSource: "Undercooked Poultry" },
  { _id: "r076", location: { name: "Paco Packed Lunch Vendors", district: "Paco", coordinates: { lat: 14.5788, lng: 120.9979 } }, illness: "Food Poisoning", severity: "Moderate", reportedAt: "2025-03-06", foodSource: "Packaged Meals" },

  { _id: "r030", location: { name: "Binondo Dim Sum Spot", district: "Binondo", coordinates: { lat: 14.6013, lng: 120.9754 } }, illness: "Salmonellosis", severity: "Moderate", reportedAt: "2025-03-08", foodSource: "Restaurant" },
  { _id: "r031", location: { name: "Ermita Food Strip", district: "Ermita", coordinates: { lat: 14.5826, lng: 120.9846 } }, illness: "Food Poisoning", severity: "Moderate", reportedAt: "2025-03-10", foodSource: "Street Food" },
  { _id: "r032", location: { name: "Malate Grill House", district: "Malate", coordinates: { lat: 14.5700, lng: 120.9850 } }, illness: "Salmonella", severity: "High", reportedAt: "2025-03-11", foodSource: "Undercooked Meat" },
  { _id: "r033", location: { name: "Paco Canteen", district: "Paco", coordinates: { lat: 14.5794, lng: 120.9967 } }, illness: "Norovirus", severity: "Low", reportedAt: "2025-03-13", foodSource: "Canteen" },
  { _id: "r034", location: { name: "Sampaloc Student Meals", district: "Sampaloc", coordinates: { lat: 14.6092, lng: 120.9890 } }, illness: "Food Poisoning", severity: "Low", reportedAt: "2025-03-15", foodSource: "Cafeteria" },
  { _id: "r035", location: { name: "Santa Cruz Mall Food Court", district: "Santa Cruz", coordinates: { lat: 14.6042, lng: 120.9810 } }, illness: "E. coli Infection", severity: "Moderate", reportedAt: "2025-03-18", foodSource: "Food Court" },

  // =========================
  // APR 2025 (still quieter)
  // =========================
  { _id: "r036", location: { name: "Intramuros Lunch Cafe", district: "Intramuros", coordinates: { lat: 14.5896, lng: 120.9747 } }, illness: "Norovirus", severity: "Low", reportedAt: "2025-04-01", foodSource: "Cafe" },
  { _id: "r037", location: { name: "San Miguel Bakery", district: "San Miguel", coordinates: { lat: 14.6019, lng: 120.9883 } }, illness: "Food Poisoning", severity: "Low", reportedAt: "2025-04-03", foodSource: "Bakery" },
  { _id: "r038", location: { name: "Port Area Canteen", district: "Port Area", coordinates: { lat: 14.5903, lng: 120.9639 } }, illness: "Food Poisoning", severity: "Moderate", reportedAt: "2025-04-05", foodSource: "Workplace Canteen" },
  { _id: "r039", location: { name: "Pandacan Food Stalls", district: "Pandacan", coordinates: { lat: 14.5906, lng: 121.0061 } }, illness: "Salmonella", severity: "High", reportedAt: "2025-04-06", foodSource: "Street Food" },
  { _id: "r040", location: { name: "San Andres Market", district: "San Andres", coordinates: { lat: 14.5669, lng: 120.9976 } }, illness: "Norovirus", severity: "Moderate", reportedAt: "2025-04-08", foodSource: "Handled Food" },
  { _id: "r077", location: { name: "Quiapo Budget Buffet", district: "Quiapo", coordinates: { lat: 14.5982, lng: 120.9828 } }, illness: "Food Poisoning", severity: "Moderate", reportedAt: "2025-04-18", foodSource: "Buffet" },
  { _id: "r078", location: { name: "Malate Pantry Meals", district: "Malate", coordinates: { lat: 14.5696, lng: 120.9869 } }, illness: "Norovirus", severity: "Low", reportedAt: "2025-04-21", foodSource: "Handled Food" },

  // =========================
  // MAY 2025 (BIG spike cluster May 02–04)
  // =========================
  { _id: "r041", location: { name: "Quiapo Night Vendors", district: "Quiapo", coordinates: { lat: 14.5986, lng: 120.9836 } }, illness: "Food Poisoning", severity: "High", reportedAt: "2025-05-02", foodSource: "Night Market" },
  { _id: "r079", location: { name: "Santa Cruz Street Noodles", district: "Santa Cruz", coordinates: { lat: 14.6051, lng: 120.9818 } }, illness: "Food Poisoning", severity: "High", reportedAt: "2025-05-02", foodSource: "Street Food" },
  { _id: "r080", location: { name: "Ermita Iced Drinks Cart", district: "Ermita", coordinates: { lat: 14.5829, lng: 120.9854 } }, illness: "E. coli Infection", severity: "High", reportedAt: "2025-05-02", foodSource: "Water/Ice" },
  { _id: "r081", location: { name: "Tondo Fried Snack Alley", district: "Tondo", coordinates: { lat: 14.6172, lng: 120.9657 } }, illness: "Food Poisoning", severity: "Moderate", reportedAt: "2025-05-02", foodSource: "Improper Storage" },
  { _id: "r082", location: { name: "Pandacan Community Picnic", district: "Pandacan", coordinates: { lat: 14.5912, lng: 121.0057 } }, illness: "Norovirus", severity: "Moderate", reportedAt: "2025-05-02", foodSource: "Community Event" },

  { _id: "r042", location: { name: "Tondo Public Market", district: "Tondo", coordinates: { lat: 14.6177, lng: 120.9670 } }, illness: "E. coli Infection", severity: "High", reportedAt: "2025-05-03", foodSource: "Water/Ice" },
  { _id: "r083", location: { name: "Binondo Takeout Counters", district: "Binondo", coordinates: { lat: 14.6020, lng: 120.9748 } }, illness: "Food Poisoning", severity: "High", reportedAt: "2025-05-03", foodSource: "Takeout" },
  { _id: "r084", location: { name: "Malate Bar Pulutan", district: "Malate", coordinates: { lat: 14.5692, lng: 120.9855 } }, illness: "Food Poisoning", severity: "Moderate", reportedAt: "2025-05-03", foodSource: "Bar Snacks" },
  { _id: "r085", location: { name: "San Andres Carinderia Strip", district: "San Andres", coordinates: { lat: 14.5662, lng: 120.9986 } }, illness: "Food Poisoning", severity: "Moderate", reportedAt: "2025-05-03", foodSource: "Reheated Stew" },

  { _id: "r086", location: { name: "Quiapo Street Vendor Cluster", district: "Quiapo", coordinates: { lat: 14.5994, lng: 120.9831 } }, illness: "Salmonella", severity: "High", reportedAt: "2025-05-04", foodSource: "Street Vendor" },
  { _id: "r087", location: { name: "Santa Ana Riverside Drinks", district: "Santa Ana", coordinates: { lat: 14.5764, lng: 121.0046 } }, illness: "E. coli Infection", severity: "High", reportedAt: "2025-05-04", foodSource: "Water/Ice" },
  { _id: "r088", location: { name: "Port Area Mess Hall", district: "Port Area", coordinates: { lat: 14.5910, lng: 120.9628 } }, illness: "Food Poisoning", severity: "High", reportedAt: "2025-05-04", foodSource: "Workplace Canteen" },

  { _id: "r043", location: { name: "Binondo Food Row", district: "Binondo", coordinates: { lat: 14.6013, lng: 120.9754 } }, illness: "Salmonellosis", severity: "Moderate", reportedAt: "2025-05-04", foodSource: "Restaurant" },
  { _id: "r044", location: { name: "Ermita Seafood Place", district: "Ermita", coordinates: { lat: 14.5826, lng: 120.9846 } }, illness: "Salmonella", severity: "High", reportedAt: "2025-05-07", foodSource: "Seafood" },
  { _id: "r045", location: { name: "Malate Bar Snacks", district: "Malate", coordinates: { lat: 14.5700, lng: 120.9850 } }, illness: "Food Poisoning", severity: "Moderate", reportedAt: "2025-05-10", foodSource: "Improper Storage" },
  { _id: "r046", location: { name: "Paco Family Meals", district: "Paco", coordinates: { lat: 14.5794, lng: 120.9967 } }, illness: "Norovirus", severity: "Low", reportedAt: "2025-05-11", foodSource: "Home Prepared" },
  { _id: "r047", location: { name: "Sampaloc Street Eats", district: "Sampaloc", coordinates: { lat: 14.6092, lng: 120.9890 } }, illness: "Food Poisoning", severity: "Moderate", reportedAt: "2025-05-13", foodSource: "Street Food" },
  { _id: "r048", location: { name: "Santa Cruz Terminal Meals", district: "Santa Cruz", coordinates: { lat: 14.6042, lng: 120.9810 } }, illness: "E. coli Infection", severity: "Moderate", reportedAt: "2025-05-15", foodSource: "Water/Ice" },
  { _id: "r049", location: { name: "Intramuros Historic Cafe", district: "Intramuros", coordinates: { lat: 14.5896, lng: 120.9747 } }, illness: "Norovirus", severity: "Low", reportedAt: "2025-05-18", foodSource: "Cafe" },
  { _id: "r050", location: { name: "San Miguel Canteen", district: "San Miguel", coordinates: { lat: 14.6019, lng: 120.9883 } }, illness: "Food Poisoning", severity: "Moderate", reportedAt: "2025-05-20", foodSource: "Canteen" },
  { _id: "r089", location: { name: "Tondo Late Lunch Packs", district: "Tondo", coordinates: { lat: 14.6183, lng: 120.9681 } }, illness: "Food Poisoning", severity: "Moderate", reportedAt: "2025-05-24", foodSource: "Packaged Meals" },
  { _id: "r090", location: { name: "Ermita Dorm Meals", district: "Ermita", coordinates: { lat: 14.5817, lng: 120.9867 } }, illness: "Norovirus", severity: "Moderate", reportedAt: "2025-05-26", foodSource: "Handled Food" },

  // =========================
  // JUN 2025 (BIGGEST spike around Jun 20–21)
  // =========================
  { _id: "r051", location: { name: "Port Area Dock Meals", district: "Port Area", coordinates: { lat: 14.5903, lng: 120.9639 } }, illness: "Salmonella", severity: "High", reportedAt: "2025-06-02", foodSource: "Packaged Meals" },
  { _id: "r052", location: { name: "Pandacan Community Event", district: "Pandacan", coordinates: { lat: 14.5906, lng: 121.0061 } }, illness: "Food Poisoning", severity: "Moderate", reportedAt: "2025-06-04", foodSource: "Community Event" },
  { _id: "r053", location: { name: "San Andres Food Strip", district: "San Andres", coordinates: { lat: 14.5669, lng: 120.9976 } }, illness: "Norovirus", severity: "Moderate", reportedAt: "2025-06-05", foodSource: "Food Court" },
  { _id: "r054", location: { name: "Santa Ana Riverside Stalls", district: "Santa Ana", coordinates: { lat: 14.5760, lng: 121.0050 } }, illness: "Food Poisoning", severity: "Moderate", reportedAt: "2025-06-07", foodSource: "Street Food" },
  { _id: "r055", location: { name: "Quiapo Market Lane", district: "Quiapo", coordinates: { lat: 14.5986, lng: 120.9836 } }, illness: "E. coli Infection", severity: "High", reportedAt: "2025-06-10", foodSource: "Water/Ice" },
  { _id: "r056", location: { name: "Tondo Street Vendors", district: "Tondo", coordinates: { lat: 14.6177, lng: 120.9670 } }, illness: "Food Poisoning", severity: "High", reportedAt: "2025-06-12", foodSource: "Street Vendor" },
  { _id: "r057", location: { name: "Binondo Restaurant", district: "Binondo", coordinates: { lat: 14.6013, lng: 120.9754 } }, illness: "Salmonellosis", severity: "Moderate", reportedAt: "2025-06-13", foodSource: "Restaurant" },
  { _id: "r058", location: { name: "Ermita Food Strip", district: "Ermita", coordinates: { lat: 14.5826, lng: 120.9846 } }, illness: "Salmonella", severity: "High", reportedAt: "2025-06-15", foodSource: "Seafood" },
  { _id: "r059", location: { name: "Malate Food Stalls", district: "Malate", coordinates: { lat: 14.5700, lng: 120.9850 } }, illness: "Norovirus", severity: "Low", reportedAt: "2025-06-18", foodSource: "Handled Food" },

  // Spike cluster: Jun 20 (multiple areas, not duplicates)
  { _id: "r060", location: { name: "Paco Wet Market", district: "Paco", coordinates: { lat: 14.5794, lng: 120.9967 } }, illness: "Food Poisoning", severity: "Moderate", reportedAt: "2025-06-20", foodSource: "Wet Market" },
  { _id: "r061", location: { name: "Santa Cruz Grab-and-Go Meals", district: "Santa Cruz", coordinates: { lat: 14.6037, lng: 120.9826 } }, illness: "Food Poisoning", severity: "High", reportedAt: "2025-06-20", foodSource: "Packaged Meals" },
  { _id: "r062", location: { name: "Quiapo Iced Drinks Cluster", district: "Quiapo", coordinates: { lat: 14.5990, lng: 120.9829 } }, illness: "E. coli Infection", severity: "High", reportedAt: "2025-06-20", foodSource: "Water/Ice" },

  // More on Jun 20 to create a proper spike
  { _id: "r091", location: { name: "Tondo Street Lugaw", district: "Tondo", coordinates: { lat: 14.6187, lng: 120.9669 } }, illness: "Food Poisoning", severity: "Moderate", reportedAt: "2025-06-20", foodSource: "Street Food" },
  { _id: "r092", location: { name: "Ermita Lunch Carinderia", district: "Ermita", coordinates: { lat: 14.5831, lng: 120.9839 } }, illness: "Norovirus", severity: "Moderate", reportedAt: "2025-06-20", foodSource: "Handled Food" },
  { _id: "r093", location: { name: "Binondo Dessert Stalls", district: "Binondo", coordinates: { lat: 14.6024, lng: 120.9757 } }, illness: "Food Poisoning", severity: "Low", reportedAt: "2025-06-20", foodSource: "Dairy/Desserts" },
  { _id: "r094", location: { name: "San Andres Eatery Row", district: "San Andres", coordinates: { lat: 14.5679, lng: 120.9969 } }, illness: "Food Poisoning", severity: "High", reportedAt: "2025-06-20", foodSource: "Improper Storage" },

  // Follow-up spike day: Jun 21 (keeps charts jagged instead of one-day-only)
  { _id: "r095", location: { name: "Port Area Seafood Packs", district: "Port Area", coordinates: { lat: 14.5899, lng: 120.9643 } }, illness: "Salmonella", severity: "High", reportedAt: "2025-06-21", foodSource: "Raw Seafood" },
  { _id: "r096", location: { name: "Malate Late-Night Shawarma", district: "Malate", coordinates: { lat: 14.5687, lng: 120.9858 } }, illness: "Food Poisoning", severity: "Moderate", reportedAt: "2025-06-21", foodSource: "Street Food" },
  { _id: "r097", location: { name: "Pandacan Water/Ice Reports", district: "Pandacan", coordinates: { lat: 14.5902, lng: 121.0074 } }, illness: "E. coli Infection", severity: "High", reportedAt: "2025-06-21", foodSource: "Water/Ice" },
  { _id: "r098", location: { name: "Sampaloc Student Meals", district: "Sampaloc", coordinates: { lat: 14.6101, lng: 120.9882 } }, illness: "Norovirus", severity: "Moderate", reportedAt: "2025-06-21", foodSource: "Cafeteria" },

  // Late June small bumps
  { _id: "r099", location: { name: "Santa Ana Evening Stalls", district: "Santa Ana", coordinates: { lat: 14.5757, lng: 121.0058 } }, illness: "Food Poisoning", severity: "Moderate", reportedAt: "2025-06-26", foodSource: "Street Food" },
  { _id: "r100", location: { name: "Intramuros Tourist Snacks", district: "Intramuros", coordinates: { lat: 14.5892, lng: 120.9753 } }, illness: "Norovirus", severity: "Low", reportedAt: "2025-06-28", foodSource: "Handled Food" },
];
