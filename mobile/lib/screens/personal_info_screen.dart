import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../services/api_service.dart';
import '../services/session.dart';
import '../utils/philippine_mobile_number.dart';
import '../widgets/app_loading.dart';
import '../widgets/philippine_mobile_prefix.dart';

class PersonalInfoScreen extends StatefulWidget {
  const PersonalInfoScreen({super.key});

  @override
  State<PersonalInfoScreen> createState() => _PersonalInfoScreenState();
}

class _PersonalInfoScreenState extends State<PersonalInfoScreen> {
  final _formKey = GlobalKey<FormState>();

  final user = Session.currentUser;

  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();

  bool _loading = false;
  bool _updated = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();

    if (user != null) {
      _nameCtrl.text = user!['username'] ?? '';
      _phoneCtrl.text = toPhilippineMobileInput(
        user!['phone_number']?.toString() ?? '',
      );
      _emailCtrl.text = user!['email'] ?? '';
    }
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();

    if (!_formKey.currentState!.validate()) return;

    setState(() => _loading = true);

    try {
      if (user == null) return;

      final userId = (user!['_id'] ?? user!['id'])?.toString();
      if (userId == null || userId.isEmpty) return;

      final updatedUser = await ApiService.updateUser(
        id: userId,
        username: _nameCtrl.text.trim(),
        phone: toLocalPhilippineMobileNumber(_phoneCtrl.text),
        email: _emailCtrl.text.trim().isEmpty ? null : _emailCtrl.text.trim(),
      );

      if (!mounted) return;

      if (updatedUser != null) {
        await Session.saveCurrentUser(updatedUser);
        if (!mounted) return;
        _nameCtrl.text = updatedUser['username'] ?? '';
        _phoneCtrl.text = toPhilippineMobileInput(
          updatedUser['phone_number']?.toString() ?? '',
        );
        _emailCtrl.text = updatedUser['email'] ?? '';
        _updated = true;

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Profile updated successfully")),
        );
      } else {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text("Update failed")));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB), // bg-gray-50
      body: SafeArea(
        top: true,
        child: ListView(
          padding: const EdgeInsets.only(bottom: 24),
          children: [
            // Header with gradient
            Container(
              padding: const EdgeInsets.fromLTRB(16, 36, 16, 36),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Color(0xFF2563EB),
                    Color(0xFF1D4ED8),
                  ], // from-blue-600 to-blue-700
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  InkWell(
                    onTap: () => Navigator.pop(context, _updated),
                    child: Row(
                      children: [
                        Icon(
                          LucideIcons.arrowLeft,
                          color: Colors.white,
                          size: 20,
                        ),
                        SizedBox(width: 6),
                        Text(
                          "Back",
                          style: GoogleFonts.inter(
                            color: Colors.white70,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Personal Information',
                    style: GoogleFonts.inter(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    'Update your account details',
                    style: GoogleFonts.inter(color: Colors.white, fontSize: 14),
                  ),
                ],
              ),
            ),
            Transform.translate(
              offset: const Offset(0, -20),
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(color: Colors.grey.shade200),
                        boxShadow: const [
                          BoxShadow(
                            color: Colors.black12,
                            blurRadius: 6,
                            offset: Offset(0, 3),
                          ),
                        ],
                      ),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _InputField(
                              label: "Name",
                              child: TextFormField(
                                controller: _nameCtrl,
                                validator: _required,
                                style: GoogleFonts.inter(),
                                decoration: InputDecoration(
                                  prefixIcon: Icon(
                                    LucideIcons.user,
                                    color: Theme.of(
                                      context,
                                    ).colorScheme.outline,
                                  ),
                                  hintText: 'Enter name',
                                  hintStyle: GoogleFonts.inter(
                                    color: Color(0xFFD1D5DB),
                                  ),
                                  contentPadding: const EdgeInsets.symmetric(
                                    vertical: 14,
                                  ),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 16),
                            _InputField(
                              label: "Phone Number",
                              child: TextFormField(
                                controller: _phoneCtrl,
                                validator: validatePhilippineMobileInput,
                                keyboardType: TextInputType.number,
                                inputFormatters: const [
                                  PhilippineMobileInputFormatter(),
                                ],
                                style: GoogleFonts.inter(),
                                decoration: InputDecoration(
                                  prefixIcon: PhilippineMobilePrefix(
                                    color: Theme.of(
                                      context,
                                    ).colorScheme.outline,
                                  ),
                                  prefixIconConstraints: const BoxConstraints(
                                    minWidth: 88,
                                  ),
                                  hintText: philippineMobileHint,
                                  hintStyle: GoogleFonts.inter(
                                    color: Color(0xFFD1D5DB),
                                  ),
                                  helperText: philippineMobileHelper,
                                  helperMaxLines: 2,
                                  contentPadding: const EdgeInsets.symmetric(
                                    vertical: 14,
                                  ),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 16),
                            _InputField(
                              label: "Email",
                              child: TextFormField(
                                controller: _emailCtrl,
                                keyboardType: TextInputType.emailAddress,
                                style: GoogleFonts.inter(),
                                decoration: InputDecoration(
                                  prefixIcon: Icon(
                                    LucideIcons.mail,
                                    color: Theme.of(
                                      context,
                                    ).colorScheme.outline,
                                  ),
                                  hintText: 'Add a recovery email',
                                  hintStyle: GoogleFonts.inter(
                                    color: Color(0xFFD1D5DB),
                                  ),
                                  contentPadding: const EdgeInsets.symmetric(
                                    vertical: 14,
                                  ),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                ),
                              ),
                            ),

                            const SizedBox(height: 24),

                            SizedBox(
                              width: double.infinity,
                              height: 54,
                              child: ElevatedButton(
                                onPressed: _loading ? null : _submit,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF2563EB),
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(14),
                                  ),
                                  elevation: 0,
                                ),
                                child: _loading
                                    ? const SizedBox(
                                        width: 20,
                                        height: 20,
                                        child: AppLoadingIndicator(
                                          size: 20,
                                          strokeWidth: 2,
                                          color: Colors.white,
                                        ),
                                      )
                                    : Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.center,
                                        children: [
                                          Icon(LucideIcons.save),
                                          SizedBox(width: 10),
                                          Text(
                                            "Save Changes",
                                            style: GoogleFonts.inter(
                                              fontWeight: FontWeight.w800,
                                            ),
                                          ),
                                        ],
                                      ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String? _required(String? v) =>
    (v == null || v.isEmpty) ? "Required field" : null;

class _InputField extends StatelessWidget {
  final String label;
  final Widget child;

  const _InputField({required this.label, required this.child});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: GoogleFonts.inter(fontSize: 13)),
        const SizedBox(height: 6),
        Theme(
          data: Theme.of(context).copyWith(
            inputDecorationTheme: InputDecorationTheme(
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 14,
                vertical: 14,
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(
                  color: Color(0xFF3B82F6),
                  width: 2,
                ),
              ),
            ),
          ),
          child: child,
        ),
      ],
    );
  }
}
