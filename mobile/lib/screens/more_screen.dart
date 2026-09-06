import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

class MoreScreen extends StatelessWidget {
  final VoidCallback? onSignIn;
  final VoidCallback? onPersonalInformation;
  final VoidCallback? onReportHistory;
  final VoidCallback? onSecurity;

  const MoreScreen({
    super.key,
    this.onSignIn,
    this.onPersonalInformation,
    this.onReportHistory,
    this.onSecurity,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: SafeArea(
        bottom: false,
        child: SingleChildScrollView(
          child: Column(
            children: [
              _buildProfileHeader(),
              _buildSettings(),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  // ----------------------------------------------------------
  // PROFILE HEADER
  // ----------------------------------------------------------

  Widget _buildProfileHeader() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(
        20,
        36,
        20,
        24,
      ),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF2563EB),
            Color(0xFF1D4ED8),
          ],
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(28),
          bottomRight: Radius.circular(28),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Profile icon
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.20),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(
              LucideIcons.user,
              color: Color(0x99FFFFFF),
              size: 32,
            ),
          ),

          const SizedBox(width: 16),

          // User information
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Hello, Guest',
                  style: GoogleFonts.inter(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),

                const SizedBox(height: 2),

                Text(
                  'Sign in to access your account',
                  style: GoogleFonts.inter(
                    color: Color(0xFFDBEAFE),
                    fontSize: 12,
                  ),
                ),

                const SizedBox(height: 8),

                // Sign in button
                Material(
                  color: Colors.white.withOpacity(0.20),
                  borderRadius: BorderRadius.circular(20),
                  child: InkWell(
                    onTap: onSignIn,
                    borderRadius: BorderRadius.circular(20),
                    child: Padding(
                      padding: EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 5,
                      ),
                      child: Text(
                        'Sign in →',
                        style: GoogleFonts.inter(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
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
  // SETTINGS
  // ----------------------------------------------------------

  Widget _buildSettings() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        16,
        20,
        16,
        0,
      ),
      child: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: const Color(0xFFF3F4F6),
          ),
        ),
        child: Column(
          children: [
            _buildSettingItem(
              icon: LucideIcons.user,
              iconColor: const Color(0xFF2563EB),
              iconBackground: const Color(0xFFDBEAFE),
              title: 'Personal Information',
              subtitle: 'Edit your profile details',
              onTap: onPersonalInformation,
              showDivider: true,
            ),

            _buildSettingItem(
              icon: LucideIcons.lock,
              iconColor: const Color(0xFF4B5563),
              iconBackground: const Color(0xFFF3F4F6),
              title: 'Security',
              subtitle: 'Change password',
              onTap: onSecurity,
              showDivider: false,
            ),

            _buildSettingItem(
              icon: LucideIcons.clipboard,
              iconColor: const Color(0xFF7C3AED),
              iconBackground: const Color(0xFFEDE9FE),
              title: 'Report History',
              subtitle: '0 submissions',
              onTap: onReportHistory,
              showDivider: true,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSettingItem({
    required IconData icon,
    required Color iconColor,
    required Color iconBackground,
    required String title,
    required String subtitle,
    required VoidCallback? onTap,
    required bool showDivider,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 14,
          ),
          decoration: BoxDecoration(
            border: showDivider
                ? const Border(
                    bottom: BorderSide(
                      color: Color(0xFFF3F4F6),
                    ),
                  )
                : null,
          ),
          child: Row(
            children: [
              // Icon
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: iconBackground,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  icon,
                  color: iconColor,
                  size: 18,
                ),
              ),

              const SizedBox(width: 12),

              // Text
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: Color(0xFF111827),
                      ),
                    ),

                    const SizedBox(height: 2),

                    Text(
                      subtitle,
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: Color(0xFF9CA3AF),
                      ),
                    ),
                  ],
                ),
              ),

              // Arrow
              const Icon(
                LucideIcons.chevronRight,
                size: 18,
                color: Color(0xFFD1D5DB),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ----------------------------------------------------------
  // ABOUT / APP INFORMATION
  // ----------------------------------------------------------

  Widget _buildAboutCard() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        16,
        16,
        16,
        0,
      ),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: const Color(0xFFF3F4F6),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                // App icon
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: const Color(0xFF2563EB),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Icon(
                    LucideIcons.circleCheck,
                    color: Colors.white,
                    size: 26,
                  ),
                ),

                const SizedBox(width: 12),

                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Food Safety Reporter',
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF111827),
                      ),
                    ),

                    SizedBox(height: 2),

                    Text(
                      'Version 1.0.0',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: Color(0xFF9CA3AF),
                      ),
                    ),
                  ],
                ),
              ],
            ),

            const SizedBox(height: 12),

            Text(
              'A citizen reporting tool to help monitor and respond '
              'to foodborne illness outbreaks in your area. Your '
              'reports help authorities spot outbreaks early and '
              'protect your community.',
              style: GoogleFonts.inter(
                fontSize: 12,
                height: 1.5,
                color: Color(0xFF6B7280),
              ),
            ),
          ],
        ),
      ),
    );
  }
}