/// Base URL for the shared Food Safe Manila backend API (port 5000).
///
/// - Android emulator: use `10.0.2.2`
/// - iOS simulator: use `127.0.0.1`
/// - Physical device: set [hostLanIp] to your machine's LAN address
class ApiConfig {
  static const bool usePhysicalDevice = true;
  static const bool useHomeWifi = true;

  /// Your development machine IP when testing on a physical phone.
  static const String hostLanIp = '192.168.1.8';

  static const String hostEmulator = '10.0.2.2';
  static const int port = 5000;

  static String get host {
    if (!usePhysicalDevice) return hostEmulator;
    return useHomeWifi ? hostLanIp : hostLanIp;
  }

  static String get baseUrl => 'http://$host:$port/api';
}
