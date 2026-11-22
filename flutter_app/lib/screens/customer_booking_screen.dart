import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/models.dart';
import '../repositories/supabase_repository.dart';
import '../theme/app_theme.dart';

class CustomerBookingScreen extends StatefulWidget {
  const CustomerBookingScreen({super.key});

  @override
  State<CustomerBookingScreen> meState() => _CustomerBookingScreenState();
}

class _CustomerBookingScreenState extends State<CustomerBookingScreen> {
  late BarberService selectedService;
  late StaffMember selectedStaff;

  final dateFormat = DateFormat('yyyy-MM-dd');
  final displayDateFormat = DateFormat('EEE d MMM', 'ar');

  late List<Map<String, String>> dates;
  late String selectedDate;

  final List<String> timeSlots = [
    "01:00 م", "02:00 م", "03:30 م", "04:30 م", "06:00 م", "07:30 م", "09:00 م", "10:30 م"
  ];
  late String selectedTime;

  final nameController = TextEditingController();
  final phoneController = TextEditingController();
  final notesController = TextEditingController();

  List<Branch> branches = [];
  Branch? selectedBranch;

  bool isSubmitting = false;
  String? errorMessage;

  @override
  void initState() {
    super.initState();
    selectedService = SupabaseRepository.availableServices.first;
    selectedStaff = SupabaseRepository.availableStaff.first;

    final user = SupabaseRepository.currentUser;
    if (user != null) {
      nameController.text = user.name;
      if (user.phone != null && user.phone!.isNotEmpty) {
        phoneController.text = user.phone!;
      }
    }

    SupabaseRepository.fetchBranches().then((list) {
      if (mounted) {
        setState(() {
          branches = list;
          if (list.isNotEmpty) selectedBranch = list.first;
        });
      }
    });

    dates = [];
    final cal = DateTime.now();
    for (int i = 0; i < 5; i++) {
      final d = cal.add(Duration(days: i));
      final iso = dateFormat.format(d);
      final label = (i == 0) ? "اليوم" : (i == 1) ? "غداً" : displayDateFormat.format(d);
      dates.add({'iso': iso, 'label': label});
    }
    selectedDate = dates.first['iso']!;
    selectedTime = timeSlots.first;
  }

  @override
  void dispose() {
    nameController.dispose();
    phoneController.dispose();
    notesController.dispose();
    super.dispose();
  }

  void submitBooking() async {
    final name = nameController.text.trim();
    final phone = phoneController.text.trim();

    if (name.isEmpty || phone.isEmpty) {
      setState(() {
        errorMessage = "يرجى كتابة الاسم ورقم الموبايل لإتمام الحجز";
      });
      return;
    }

    setState(() {
      errorMessage = null;
      isSubmitting = true;
    });

    final res = Reservation(
      id: "res_${DateTime.now().millisecondsSinceEpoch}",
      branchId: selectedBranch?.id ?? "1",
      customerName: name,
      phone: phone,
      date: selectedDate,
      time: selectedTime,
      serviceName: selectedService.name,
      staffName: selectedStaff.name,
      status: "pending",
      notes: notesController.text.trim().isEmpty ? null : notesController.text.trim(),
      createdAt: DateTime.now().toIso8601String(),
    );

    final success = await SupabaseRepository.createReservation(res);

    if (!mounted) return;

    setState(() {
      isSubmitting = false;
    });

    if (success) {
      showDialog(
        context: context,
        builder: (_) => AlertDialog(
          backgroundColor: AppColors.slate900,
          title: const Text(
            "🎉 تم استلام حجزك بنجاح!",
            textAlign: TextAlign.right,
            style: TextStyle(color: AppColors.white, fontWeight: FontWeight.bold, fontSize: 18),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAlignment.end,
            children: [
              Text("الخدمة: ${selectedService.name}", style: const TextStyle(color: AppColors.slate200, fontSize: 14)),
              const SizedBox(height: 4),
              Text(
                "الموعد: $selectedDate في تمام الساعة $selectedTime",
                style: const TextStyle(color: AppColors.emerald400, fontSize: 14, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              Text("المصفف: ${selectedStaff.name}", style: const TextStyle(color: AppColors.slate200, fontSize: 13)),
              const SizedBox(height: 12),
              const Text(
                "تم إرسال الطلب لصالون فلير وان (Flare One) وسيتواصل معك الكاشير أو تجد موعدك مؤكداً.",
                textAlign: TextAlign.right,
                style: TextStyle(color: AppColors.slate400, fontSize: 12),
              ),
            ],
          ),
          actions: [
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.emerald600),
              onPressed: () {
                Navigator.pop(context);
                Navigator.pop(context);
              },
              child: const Text("حسناً، تم", style: TextStyle(color: AppColors.white)),
            ),
          ],
        ),
      );
    } else {
      setState(() {
        errorMessage = "حدث خطأ أثناء إرسال الحجز، يرجى المحاولة مرة أخرى.";
      });
    }
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
            "حجز موعد جديد",
            style: TextStyle(color: AppColors.white, fontSize: 18, fontWeight: FontWeight.bold),
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAlignment.end,
          children: [
            if (branches.isNotEmpty) ...[
              _sectionHeader("0. اختر فرع الصالون"),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                reverse: true,
                child: Row(
                  children: branches.map((b) {
                    final isSel = selectedBranch?.id == b.id;
                    return GestureDetector(
                      onTap: () => setState(() => selectedBranch = b),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        margin: const EdgeInsets.only(left: 8),
                        decoration: BoxDecoration(
                          color: isSel ? AppColors.emerald500 : AppColors.slate900,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isSel ? AppColors.emerald400 : AppColors.slate800,
                          ),
                        ),
                        child: Text(
                          b.name,
                          style: TextStyle(
                            color: isSel ? Colors.white : AppColors.slate300,
                            fontSize: 13,
                            fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 16),
            ],

            _sectionHeader("1. اختر الخدمة المطلوبة"),

            // Services List
            ...SupabaseRepository.availableServices.map((service) {
              final isSelected = service.id == selectedService.id;
              return Padding(
                padding: const EdgeInsets.only(bottom: 10.0),
                child: Material(
                  color: isSelected ? AppColors.emerald500.withOpacity(0.1) : AppColors.slate900,
                  borderRadius: BorderRadius.circular(14),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(14),
                    onTap: () => setState(() => selectedService = service),
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: isSelected ? AppColors.emerald500 : AppColors.slate800,
                        ),
                      ),
                      child: Row(
                        children: [
                          Text(
                            "${service.price.toInt()} ج.م",
                            style: TextStyle(
                              color: isSelected ? AppColors.emerald400 : AppColors.amber400,
                              fontSize: 15,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const Spacer(),
                          Column(
                            crossAxisAlignment: CrossAlignment.end,
                            children: [
                              Text(
                                service.name,
                                style: const TextStyle(color: AppColors.white, fontSize: 14, fontWeight: FontWeight.bold),
                              ),
                              Text(
                                "⏱️ ${service.durationMinutes} دقيقة • تصنيف: ${service.category}",
                                style: const TextStyle(color: AppColors.slate400, fontSize: 11),
                              ),
                            ],
                          ),
                          const SizedBox(width: 12),
                          Text(service.iconEmoji, style: const TextStyle(fontSize: 24)),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            }),

            const SizedBox(height: 16),
            _sectionHeader("2. اختر المصفف المفضل"),

            SizedBox(
              height: 60,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                reverse: true,
                itemCount: SupabaseRepository.availableStaff.length,
                separatorBuilder: (_, __) => const SizedBox(width: 10),
                itemBuilder: (_, index) {
                  final staff = SupabaseRepository.availableStaff[index];
                  final isSelected = staff.id == selectedStaff.id;
                  return InkWell(
                    onTap: () => setState(() => selectedStaff = staff),
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: isSelected ? AppColors.cyan500.withOpacity(0.15) : AppColors.slate900,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: isSelected ? AppColors.cyan500 : AppColors.slate800),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            staff.name,
                            style: TextStyle(
                              color: isSelected ? AppColors.cyan400 : AppColors.white,
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(staff.role, style: const TextStyle(color: AppColors.slate400, fontSize: 10)),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),

            const SizedBox(height: 16),
            _sectionHeader("3. اليوم والتاريخ"),

            SizedBox(
              height: 45,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                reverse: true,
                itemCount: dates.length,
                separatorBuilder: (_, __) => const SizedBox(width: 10),
                itemBuilder: (_, index) {
                  final d = dates[index];
                  final isSelected = d['iso'] == selectedDate;
                  return InkWell(
                    onTap: () => setState(() => selectedDate = d['iso']!),
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      decoration: BoxDecoration(
                        color: isSelected ? AppColors.emerald500.withOpacity(0.2) : AppColors.slate900,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: isSelected ? AppColors.emerald500 : AppColors.slate800),
                      ),
                      child: Text(
                        d['label']!,
                        style: TextStyle(
                          color: isSelected ? AppColors.emerald400 : AppColors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),

            const SizedBox(height: 16),
            _sectionHeader("4. الوقت المناسب"),

            SizedBox(
              height: 40,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                reverse: true,
                itemCount: timeSlots.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, index) {
                  final slot = timeSlots[index];
                  final isSelected = slot == selectedTime;
                  return InkWell(
                    onTap: () => setState(() => selectedTime = slot),
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: isSelected ? AppColors.amber500.withOpacity(0.2) : AppColors.slate900,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: isSelected ? AppColors.amber500 : AppColors.slate800),
                      ),
                      child: Text(
                        slot,
                        style: TextStyle(
                          color: isSelected ? AppColors.amber400 : AppColors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),

            const SizedBox(height: 16),
            _sectionHeader("5. بيانات التواصل"),

            TextField(
              controller: nameController,
              textAlign: TextAlign.right,
              style: const TextStyle(color: AppColors.white),
              decoration: _inputDecoration("الاسم بالكامل", "مثال: محمد أحمد"),
            ),

            const SizedBox(height: 10),

            TextField(
              controller: phoneController,
              keyboardType: TextInputType.phone,
              textAlign: TextAlign.right,
              style: const TextStyle(color: AppColors.white),
              decoration: _inputDecoration("رقم الموبايل (لإرسال إشعار التأكيد)", "010xxxxxxxx"),
            ),

            const SizedBox(height: 10),

            TextField(
              controller: notesController,
              textAlign: TextAlign.right,
              style: const TextStyle(color: AppColors.white),
              decoration: _inputDecoration("ملاحظات إضافية (اختياري)", ""),
            ),

            if (errorMessage != null) ...[
              const SizedBox(height: 12),
              Center(
                child: Text(
                  errorMessage!,
                  style: const TextStyle(color: AppColors.red500, fontSize: 13, fontWeight: FontWeight.w500),
                ),
              ),
            ],

            const SizedBox(height: 20),

            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.emerald600,
                  shape: RoundedCornerShape(12),
                ),
                onPressed: isSubmitting ? null : submitBooking,
                child: isSubmitting
                    ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: AppColors.white, strokeWidth: 2))
                    : const Text("تأكيد طلب الحجز الفوري", style: TextStyle(color: AppColors.white, fontSize: 16, fontWeight: FontWeight.bold)),
              ),
            ),

            const SizedBox(height: 28),
          ],
        ),
      ),
    );
  }

  Widget _sectionHeader(String title) {
    return Column(
      crossAxisAlignment: CrossAlignment.end,
      children: [
        Text(
          title,
          style: const TextStyle(color: AppColors.slate300, fontSize: 14, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
      ],
    );
  }

  InputDecoration _inputDecoration(String label, String hint) {
    return InputDecoration(
      labelText: label,
      hintText: hint.isNotEmpty ? hint : null,
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
    );
  }
}
