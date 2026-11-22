import 'package:flutter/material.dart';
import '../repositories/supabase_repository.dart';
import '../theme/app_theme.dart';
import 'auth_screen.dart';
import 'manager_dashboard_screen.dart';
import 'customer_booking_screen.dart';
import 'customer_appointments_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = SupabaseRepository.currentUser;
    final isAdmin = user?.isAdmin == true;
    final isCustomer = user?.isCustomer == true;

    return Scaffold(
      backgroundColor: AppColors.slate950,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAlignment.center,
            children: [
              // Top Bar with User Info and Logout
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  IconButton(
                    icon: const Icon(Icons.exit_to_app, color: Colors.redAccent),
                    tooltip: "تسجيل الخروج",
                    onPressed: () {
                      SupabaseRepository.logout();
                      Navigator.pushAndRemoveUntil(
                        context,
                        MaterialPageRoute(builder: (_) => const AuthScreen()),
                        (route) => false,
                      );
                    },
                  ),
                  Row(
                    children: [
                      Column(
                        crossAxisAlignment: CrossAlignment.end,
                        children: [
                          Text(
                            user?.name ?? "مستخدم",
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                          Text(
                            isAdmin ? "مدير النظام" : (isCustomer ? "عميل" : "مستخدم"),
                            style: TextStyle(
                              color: isAdmin ? AppColors.amber500 : AppColors.emerald400,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(width: 10),
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: isAdmin ? AppColors.amber500.withOpacity(0.2) : AppColors.emerald500.withOpacity(0.2),
                          shape: BoxShape.circle,
                          border: Border.all(color: isAdmin ? AppColors.amber500 : AppColors.emerald500),
                        ),
                        child: Icon(
                          isAdmin ? Icons.admin_panel_settings : Icons.person,
                          color: isAdmin ? AppColors.amber500 : AppColors.emerald400,
                          size: 20,
                        ),
                      ),
                    ],
                  ),
                ],
              ),

              const SizedBox(height: 16),

              // Title & Subtitle
              const Text(
                "فلير وان Flare One",
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                "النظام السحابي الموحد لإدارة الفروع والكاشير والحجوزات",
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppColors.slate400,
                  fontSize: 13,
                ),
              ),

              const SizedBox(height: 28),

              const Align(
                alignment: Alignment.centerRight,
                child: Text(
                  "الأقسام المتاحة لك",
                  style: TextStyle(
                    color: AppColors.slate200,
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),

              const SizedBox(height: 14),

              // 1. Manager Dashboard Card (Visible to Admins ONLY)
              if (isAdmin || user == null)
                _PortalCard(
                  title: "لوحة تحكم المدير اللحظية",
                  subtitle: "متابعة مبيعات كافة الفروع، درج الكاش، الحسابات البنكية، والديون",
                  icon: Icons.assessment,
                  badge: "للإدارة والمالك",
                  accentColor: AppColors.emerald500,
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const ManagerDashboardScreen()),
                    );
                  },
                ),

              if (isAdmin || user == null) const SizedBox(height: 14),

              // 2. Customer Booking Card (Available for Customers and Admins)
              _PortalCard(
                title: "حجز موعد جديد",
                subtitle: "اختيار الفرع، الخدمة المطلوبة، المصفف المفضل والتوقيت المناسب",
                icon: Icons.calendar_month,
                badge: "حجز فوري",
                accentColor: AppColors.cyan500,
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const CustomerBookingScreen()),
                  );
                },
              ),

              const SizedBox(height: 14),

              // 3. My Appointments Track Card
              _PortalCard(
                title: "متابعة حجوزاتي",
                subtitle: "استعلام ومتابعة حالة المواعيد المؤكدة والملغاة وتفاصيلها",
                icon: Icons.event_available,
                badge: "استعلام لحظي",
                accentColor: AppColors.amber500,
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const CustomerAppointmentsScreen()),
                  );
                },
              ),

              const Spacer(),

              // Footer
              const Text(
                "نسخة Flutter الموحدة • جاهزة للعمل على iPhone (iOS) و Android",
                style: TextStyle(
                  color: AppColors.slate600,
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PortalCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final String badge;
  final Color accentColor;
  final VoidCallback onTap;

  const _PortalCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.badge,
    required this.accentColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.slate900,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.slate800),
          ),
          child: Row(
            children: [
              const Icon(Icons.arrow_back_ios_new, color: AppColors.slate600, size: 16),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAlignment.end,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: accentColor.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: accentColor.withOpacity(0.3)),
                          ),
                          child: Text(
                            badge,
                            style: TextStyle(
                              color: accentColor,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          title,
                          style: const TextStyle(
                            color: AppColors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      subtitle,
                      textAlign: TextAlign.right,
                      style: const TextStyle(
                        color: AppColors.slate400,
                        fontSize: 11,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 14),
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: accentColor.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: accentColor.withOpacity(0.3)),
                ),
                child: Icon(icon, color: accentColor, size: 24),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
