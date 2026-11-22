import 'package:flutter/material.dart';
import '../models/models.dart';
import '../repositories/supabase_repository.dart';
import '../theme/app_theme.dart';
import 'home_screen.dart';
import 'manager_dashboard_screen.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  bool isRegisterMode = false; // false = Login, true = Customer Register

  // Login form controllers
  final _loginIdController = TextEditingController();
  final _loginPassController = TextEditingController();
  bool _showLoginPassword = false;

  // Register form controllers
  final _regFirstNameController = TextEditingController();
  final _regLastNameController = TextEditingController();
  final _regEmailPhoneController = TextEditingController();
  final _regPassController = TextEditingController();
  final _regConfirmPassController = TextEditingController();
  bool _showRegPassword = false;
  bool _agreePolicy = false;

  bool _isLoading = false;
  String? _errorMessage;
  String? _successMessage;

  @override
  void dispose() {
    _loginIdController.dispose();
    _loginPassController.dispose();
    _regFirstNameController.dispose();
    _regLastNameController.dispose();
    _regEmailPhoneController.dispose();
    _regPassController.dispose();
    _regConfirmPassController.dispose();
    super.dispose();
  }

  void _handleLogin() async {
    final id = _loginIdController.text.trim();
    final pass = _loginPassController.text;

    if (id.isEmpty || pass.isEmpty) {
      setState(() => _errorMessage = "يرجى ملء جميع الحقول");
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _successMessage = null;
    });

    try {
      final user = await SupabaseRepository.login(id, pass);
      if (!mounted) return;
      
      if (user.isAdmin) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const ManagerDashboardScreen()),
        );
      } else {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const HomeScreen()),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _errorMessage = e.toString().replaceAll("Exception: ", "");
      });
    }
  }

  void _handleRegister() async {
    final first = _regFirstNameController.text.trim();
    final last = _regLastNameController.text.trim();
    final emailPhone = _regEmailPhoneController.text.trim();
    final pass = _regPassController.text;
    final confirm = _regConfirmPassController.text;

    if (first.isEmpty || last.isEmpty || emailPhone.isEmpty || pass.isEmpty) {
      setState(() => _errorMessage = "يرجى ملء كافة الحقول المطلوبة");
      return;
    }

    if (pass.length < 6) {
      setState(() => _errorMessage = "كلمة المرور يجب أن لا تقل عن 6 خانات");
      return;
    }

    if (pass != confirm) {
      setState(() => _errorMessage = "كلمتا المرور غير متطابقتين");
      return;
    }

    if (!_agreePolicy) {
      setState(() => _errorMessage = "يجب الموافقة على سياسة الخصوصية للمتابعة");
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _successMessage = null;
    });

    try {
      final user = await SupabaseRepository.registerCustomer(
        firstName: first,
        lastName: last,
        emailOrPhone: emailPhone,
        password: pass,
      );

      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const HomeScreen()),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _errorMessage = e.toString().replaceAll("Exception: ", "");
      });
    }
  }

  void _showPrivacyPolicyDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surfaceDark,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          "سياسة الخصوصية وحماية البيانات",
          textAlign: TextAlign.right,
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
        ),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisSize: MainAxisSize.min,
            children: const [
              Text(
                "1. سرية البيانات:\nنلتزم بحماية بياناتك الشخصية (الاسم، الهاتف، وتفاصيل الحجوزات) وتشفيرها بالكامل ولن يتم مشاركتها مع أي طرف ثالث.\n\n"
                "2. صلاحيات الحساب:\nحساب العميل مخصص حصرياً لإجراء ومتابعة الحجوزات ولا يملك أي وصول إلى البيانات المالية أو سجلات الكاشير.\n\n"
                "3. حماية العمليات السحابية:\nيتم تأمين كافة الاتصالات بقواعد أمان Row Level Security (RLS) لضمان الخصوصية التامة بين الفروع والمستخدمين.",
                textAlign: TextAlign.right,
                style: TextStyle(color: AppTheme.textSecondary, fontSize: 13, height: 1.6),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text("إغلاق", style: TextStyle(color: AppTheme.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () {
              setState(() => _agreePolicy = true);
              Navigator.pop(ctx);
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryColor),
            child: const Text("موافق ومتابعة", style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.scaffoldDark,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Branding Logo Icon
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppTheme.primaryColor, AppTheme.accentTeal],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(22),
                    boxShadow: [
                      BoxShadow(
                        color: AppTheme.primaryColor.withOpacity(0.35),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      )
                    ],
                  ),
                  child: const Icon(Icons.cloud_sync, color: Colors.white, size: 38),
                ),
                const SizedBox(height: 16),
                const Text(
                  "Flare One فلير وان",
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  "النظام السحابي الموحد لإدارة الفروع والمبيعات والحجوزات",
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                ),
                const SizedBox(height: 24),

                // Mode Switch Segment
                Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: AppTheme.surfaceDark,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppTheme.borderDark),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() {
                            isRegisterMode = false;
                            _errorMessage = null;
                          }),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            decoration: BoxDecoration(
                              color: !isRegisterMode ? AppTheme.primaryColor : Colors.transparent,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            alignment: Alignment.Center,
                            child: Text(
                              "تسجيل الدخول",
                              style: TextStyle(
                                color: !isRegisterMode ? Colors.white : AppTheme.textSecondary,
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ),
                      ),
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() {
                            isRegisterMode = true;
                            _errorMessage = null;
                          }),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            decoration: BoxDecoration(
                              color: isRegisterMode ? AppTheme.primaryColor : Colors.transparent,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            alignment: Alignment.Center,
                            child: Text(
                              "حساب عميل جديد ✨",
                              style: TextStyle(
                                color: isRegisterMode ? Colors.white : AppTheme.textSecondary,
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Error Message
                if (_errorMessage != null)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF451A1A),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: Colors.red.shade900),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline, color: Colors.redAccent, size: 20),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _errorMessage!,
                            style: const TextStyle(color: Color(0xFFFECACA), fontSize: 12, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                  ),

                // Mode Form
                if (!isRegisterMode) _buildLoginForm() else _buildRegisterForm(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLoginForm() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.surfaceDark,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppTheme.borderDark),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            "مرحباً بعودتك",
            textAlign: TextAlign.right,
            style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          const Text(
            "أدخل بيانات حسابك للمتابعة",
            textAlign: TextAlign.right,
            style: TextStyle(color: AppTheme.textSecondary, fontSize: 12),
          ),
          const SizedBox(height: 18),

          // Identifier
          TextField(
            controller: _loginIdController,
            style: const TextStyle(color: Colors.white),
            textAlign: TextAlign.right,
            decoration: InputDecoration(
              labelText: "اسم المستخدم / البريد / الهاتف",
              labelStyle: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
              prefixIcon: const Icon(Icons.person, color: AppTheme.textSecondary, size: 20),
              filled: true,
              fillColor: AppTheme.cardDark,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppTheme.primaryColor)),
            ),
          ),
          const SizedBox(height: 14),

          // Password
          TextField(
            controller: _loginPassController,
            obscureText: !_showLoginPassword,
            style: const TextStyle(color: Colors.white),
            textAlign: TextAlign.right,
            decoration: InputDecoration(
              labelText: "كلمة المرور",
              labelStyle: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
              prefixIcon: const Icon(Icons.lock, color: AppTheme.textSecondary, size: 20),
              suffixIcon: IconButton(
                icon: Icon(
                  _showLoginPassword ? Icons.visibility_off : Icons.visibility,
                  color: AppTheme.textSecondary,
                  size: 20,
                ),
                onPressed: () => setState(() => _showLoginPassword = !_showLoginPassword),
              ),
              filled: true,
              fillColor: AppTheme.cardDark,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppTheme.primaryColor)),
            ),
          ),
          const SizedBox(height: 22),

          // Submit Button
          SizedBox(
            height: 52,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _handleLogin,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primaryColor,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: _isLoading
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: const [
                        Text("تسجيل الدخول", style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
                        SizedBox(width: 8),
                        Icon(Icons.arrow_back, color: Colors.white, size: 18),
                      ],
                    ),
            ),
          ),
          const SizedBox(height: 16),

          // Admin Notice Box
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppTheme.cardDark.withOpacity(0.5),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppTheme.borderDark),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Icon(Icons.info_outline, color: AppTheme.accentGold, size: 18),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    "تنويه: حسابات المدراء والكاشير يتم إنشاؤها عبر سيستم الكاشير على الكمبيوتر فقط. يمكن للمدير تسجيل الدخول هنا ومتابعة كافة الفروع والفواتير لحظياً.",
                    textAlign: TextAlign.right,
                    style: TextStyle(color: AppTheme.textSecondary, fontSize: 11, height: 1.4),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRegisterForm() {
    final pass = _regPassController.text;
    final confirm = _regConfirmPassController.text;
    final passwordsMatch = pass.isNotEmpty && pass == confirm;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.surfaceDark,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppTheme.borderDark),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: const [
              Text("(حجوزات فقط)", style: TextStyle(color: AppTheme.primaryColor, fontSize: 11, fontWeight: FontWeight.bold)),
              SizedBox(width: 6),
              Text("إنشاء حساب عميل", style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 4),
          const Text(
            "احجز مواعيدك وتابع حجوزاتك لدى كافة الفروع بسهولة",
            textAlign: TextAlign.right,
            style: TextStyle(color: AppTheme.textSecondary, fontSize: 12),
          ),
          const SizedBox(height: 18),

          // First & Last Name
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _regLastNameController,
                  style: const TextStyle(color: Colors.white),
                  textAlign: TextAlign.right,
                  decoration: InputDecoration(
                    labelText: "اسم العائلة *",
                    labelStyle: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                    filled: true,
                    fillColor: AppTheme.cardDark,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppTheme.primaryColor)),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: _regFirstNameController,
                  style: const TextStyle(color: Colors.white),
                  textAlign: TextAlign.right,
                  decoration: InputDecoration(
                    labelText: "الاسم الأول *",
                    labelStyle: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                    filled: true,
                    fillColor: AppTheme.cardDark,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppTheme.primaryColor)),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Phone or Email
          TextField(
            controller: _regEmailPhoneController,
            style: const TextStyle(color: Colors.white),
            textAlign: TextAlign.right,
            decoration: InputDecoration(
              labelText: "البريد الإلكتروني أو رقم الهاتف *",
              labelStyle: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
              prefixIcon: const Icon(Icons.phone, color: AppTheme.textSecondary, size: 20),
              filled: true,
              fillColor: AppTheme.cardDark,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppTheme.primaryColor)),
            ),
          ),
          const SizedBox(height: 14),

          // Password
          TextField(
            controller: _regPassController,
            obscureText: !_showRegPassword,
            style: const TextStyle(color: Colors.white),
            textAlign: TextAlign.right,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              labelText: "كلمة المرور (6 خانات على الأقل) *",
              labelStyle: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
              prefixIcon: const Icon(Icons.lock, color: AppTheme.textSecondary, size: 20),
              suffixIcon: IconButton(
                icon: Icon(_showRegPassword ? Icons.visibility_off : Icons.visibility, color: AppTheme.textSecondary, size: 20),
                onPressed: () => setState(() => _showRegPassword = !_showRegPassword),
              ),
              filled: true,
              fillColor: AppTheme.cardDark,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppTheme.primaryColor)),
            ),
          ),
          const SizedBox(height: 14),

          // Confirm Password
          TextField(
            controller: _regConfirmPassController,
            obscureText: !_showRegPassword,
            style: const TextStyle(color: Colors.white),
            textAlign: TextAlign.right,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              labelText: "تأكيد كلمة المرور *",
              labelStyle: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
              prefixIcon: const Icon(Icons.lock_reset, color: AppTheme.textSecondary, size: 20),
              suffixIcon: confirm.isNotEmpty
                  ? Icon(
                      passwordsMatch ? Icons.check_circle : Icons.error,
                      color: passwordsMatch ? AppTheme.primaryColor : Colors.redAccent,
                      size: 20,
                    )
                  : null,
              filled: true,
              fillColor: AppTheme.cardDark,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide(color: passwordsMatch ? AppTheme.primaryColor : Colors.redAccent),
              ),
            ),
          ),
          const SizedBox(height: 14),

          // Privacy Policy Checkbox
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              GestureDetector(
                onTap: _showPrivacyPolicyDialog,
                child: const Text(
                  "سياسة الخصوصية وحماية البيانات",
                  style: TextStyle(color: AppTheme.primaryColor, fontSize: 12, fontWeight: FontWeight.bold, decoration: TextDecoration.underline),
                ),
              ),
              const Text(" أوافق على ", style: TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
              Checkbox(
                value: _agreePolicy,
                activeColor: AppTheme.primaryColor,
                onChanged: (v) => setState(() => _agreePolicy = v ?? false),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Submit Button
          SizedBox(
            height: 52,
            child: ElevatedButton(
              onPressed: (_isLoading || !passwordsMatch || !_agreePolicy) ? null : _handleRegister,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primaryColor,
                disabledBackgroundColor: AppTheme.primaryColor.withOpacity(0.3),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: _isLoading
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text("ابدأ الآن ✨", style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }
}
