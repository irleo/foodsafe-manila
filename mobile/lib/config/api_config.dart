class ApiConfig {
  static const String deployedBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: '',
  );

  static const bool usePhysicalDevice = false;
  static const bool useHomeWifi = true;

  /// Your development machine IP when testing on a physical phone.
  static const String hostLanIp = '192.168.1.9';
  static const String hostHotspotIp = '10.102.88.214';

  static const String hostEmulator = '10.0.2.2';
  static const int port = 5000;

  static String get host {
    if (!usePhysicalDevice) return hostEmulator;
    return useHomeWifi ? hostLanIp : hostHotspotIp;
  }

  static String get baseUrl {
    if (deployedBaseUrl.isNotEmpty) return deployedBaseUrl;
    return 'http://$host:$port/api';
  }
}
