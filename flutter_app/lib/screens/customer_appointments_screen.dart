import 'package:flutter/material.dart';
import '../models/models.dart';
import '../repositories/supabase_repository.dart';
import '../theme/app_theme.dart';

class CustomerAppointmentsScreen extends StatefulWidget {
  const CustomerAppointmentsScreen({super.key});

  @override
  State<CustomerAppointmentsScreen> meState() => _CustomerAppointmentsScreenState();
}

class _CustomerAppointmentsScreenState extends State<CustomerAppointmentsScreen> {
  final phoneController = TextEditingController();
  List<Reservation> reservations = [];
  bool isLoading = false;
  bool hasSearched = false;

  @override
  void initState() {
    super.initState();
    final user = SupabaseRepository.currentUser;
    if (user != null && user.phone != null && user.phone!.isNotEmpty) {
      phoneController.text = user.phone!;
      Future.microtask(() => searchAppointments());
    }
  }

  void search() async {
    final phone = phoneController.text.trim();
    if (phone.isEmpty) return;

    setState(() {
      isLoading = true;
      hasSearched = true;
    });

    final list = await SupabaseRepository.fetchReservations(phoneFilter: phone);

    if (!mounted) return;

    setState(() {
      reservations = list;
      isLoading = false;
    });
  }

  @override
  void dispose() {
    phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.slate950,
      appBar: AppBar(
        backgroundColor: AppColors.slate900,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Align(
          alignment: Alignment.centerRight,
          child: Text(
            "متابعة حجوزاتي",
            style: TextStyle(color: AppColors.white, fontSize: 18, fontWeight: FontWeight.bold),
          ),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            // Search Bar
            Row(
              children: [
                SizedBox(
                  height: 56,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.emerald600,
                      shape: RoundedCornerShape(12),
                    ),
                    onPressed: search,
                    child: const Icon(Icons.search, color: AppColors.white),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: phoneController,
                    keyboardType: TextInputType.phone,
                    textAlign: TextAlign.right,
                    style: const TextStyle(color: AppColors.white),
                    decoration: InputDecoration(
                      labelText: "أدخل رقم هاتفك",
                      hintText: "010xxxxxxxx",
                      labelStyle: const TextStyle(color: AppColors.slate400),
                      hintStyle: const TextStyle(color: AppColors.slate600),
                      filled: true,
                      fillColor: AppColors.slate900,
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppColors.slate700),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppColors.emerald500),
                      ),
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 20),

            Expanded(
              child: isLoading
                  ? const Center(child: CircularProgressIndicator(color: AppColors.emerald500))
                  : (hasSearched && reservations.isEmpty)
                      ? const Center(
                          child: Text(
                            "لا توجد حجوزات مسجلة بهذا الرقم",
                            style: TextStyle(color: AppColors.slate400, fontSize: 14),
                          ),
                        )
                      : ListView.separated(
                          itemCount: reservations.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 12),
                          itemBuilder: (_, index) {
                            return _ReservationCard(item: reservations[index]);
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReservationCard extends StatelessWidget {
  final Reservation item;

  const _ReservationCard({required this.item});

  @override
  Widget build(BuildContext context) {
    Color statusColor;
    String statusText;

    switch (item.status) {
      case "confirmed":
        statusColor = AppColors.emerald400;
        statusText = "تم التأكيد ✅";
        break;
      case "completed":
        statusColor = AppColors.cyan400;
        statusText = "مكتمل 👍";
        break;
      case "cancelled":
        statusColor = AppColors.red500;
        statusText = "ملغي ❌";
        break;
      default:
        statusColor = AppColors.amber400;
        statusText = "قيد المراجعة ⏳";
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.slate900,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.slate800),
      ),
      child: Column(
        crossAxisAlignment: CrossAlignment.end,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  statusText,
                  style: TextStyle(color: statusColor, fontSize: 12, fontWeight: FontWeight.bold),
                ),
              ),
              Text(
                item.serviceName,
                style: const TextStyle(color: AppColors.white, fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            "الموعد: ${item.date} • الساعة ${item.time}",
            style: const TextStyle(color: AppColors.slate200, fontSize: 13, fontWeight: FontWeight.w500),
          ),
          Text(
            "المصفف: ${item.staffName}",
            style: const TextStyle(color: AppColors.slate400, fontSize: 12),
          ),
          if (item.notes != null && item.notes!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              "ملاحظات: ${item.notes}",
              style: const TextStyle(color: AppColors.slate400, fontSize: 11),
            ),
          ],
        ],
      ),
    );
  }
}
