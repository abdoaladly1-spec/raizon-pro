package com.raizon.procashier.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.raizon.procashier.data.*
import com.raizon.procashier.ui.theme.*
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomerBookingScreen(
    onBack: () -> Unit,
    onBookingSuccess: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var selectedService by remember { mutableStateOf(SupabaseRepository.availableServices.first()) }
    var selectedStaff by remember { mutableStateOf(SupabaseRepository.availableStaff.first()) }

    val dateFormat = remember { SimpleDateFormat("yyyy-MM-dd", Locale.ENGLISH) }
    val displayDateFormat = remember { SimpleDateFormat("EEE d MMM", Locale("ar")) }

    // Next 5 days
    val dates = remember {
        val list = mutableListOf<Pair<String, String>>()
        val cal = Calendar.getInstance()
        for (i in 0..4) {
            val iso = dateFormat.format(cal.time)
            val label = if (i == 0) "اليوم" else if (i == 1) "غداً" else displayDateFormat.format(cal.time)
            list.add(Pair(iso, label))
            cal.add(Calendar.DAY_OF_YEAR, 1)
        }
        list
    }

    var selectedDate by remember { mutableStateOf(dates.first().first) }

    val timeSlots = listOf("01:00 م", "02:00 م", "03:30 م", "04:30 م", "06:00 م", "07:30 م", "09:00 م", "10:30 م")
    var selectedTime by remember { mutableStateOf(timeSlots.first()) }

    val authUser = SupabaseRepository.currentUser
    var customerName by remember { mutableStateOf(authUser?.name ?: "") }
    var customerPhone by remember { mutableStateOf(authUser?.phone ?: "") }
    var notes by remember { mutableStateOf("") }

    var branches by remember { mutableStateOf<List<Branch>>(emptyList()) }
    var selectedBranch by remember { mutableStateOf<Branch?>(null) }

    LaunchedEffect(Unit) {
        val bRes = SupabaseRepository.fetchBranches()
        if (bRes.isSuccess) {
            val list = bRes.getOrDefault(emptyList())
            branches = list
            if (list.isNotEmpty()) selectedBranch = list.first()
        }
    }

    var isSubmitting by remember { mutableStateOf(false) }
    var showSuccessDialog by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "حجز موعد جديد",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = White,
                        modifier = Modifier.fillMaxWidth(),
                        textAlign = TextAlign.Right
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "رجوع", tint = White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Slate900)
            )
        },
        containerColor = Slate950
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Branch Selection
            if (branches.isNotEmpty()) {
                item {
                    Spacer(modifier = Modifier.height(4.dp))
                    SectionHeader("0. اختر فرع الصالون")
                    Spacer(modifier = Modifier.height(6.dp))
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(branches) { branch ->
                            val isSelected = selectedBranch?.id == branch.id
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(if (isSelected) Emerald500 else Slate900)
                                    .border(1.dp, if (isSelected) Emerald400 else Slate800, RoundedCornerShape(12.dp))
                                    .clickable { selectedBranch = branch }
                                    .padding(horizontal = 16.dp, vertical = 10.dp)
                            ) {
                                Text(
                                    text = branch.name,
                                    color = if (isSelected) White else Slate300,
                                    fontSize = 13.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                                )
                            }
                        }
                    }
                }
            }

            item {
                Spacer(modifier = Modifier.height(4.dp))
                SectionHeader("1. اختر الخدمة المطلوبة")
            }

            // Services Grid/List
            items(SupabaseRepository.availableServices) { service ->
                val isSelected = service.id == selectedService.id
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .border(
                            1.dp,
                            if (isSelected) Emerald500 else Slate800,
                            RoundedCornerShape(14.dp)
                        )
                        .clickable { selectedService = service },
                    colors = CardDefaults.cardColors(
                        containerColor = if (isSelected) Emerald500.copy(alpha = 0.1f) else Slate900
                    )
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "${service.price.toInt()} ج.م",
                            color = if (isSelected) Emerald400 else Amber400,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Black
                        )

                        Spacer(modifier = Modifier.weight(1f))

                        Column(horizontalAlignment = Alignment.End) {
                            Text(
                                text = service.name,
                                color = White,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "⏱️ ${service.durationMinutes} دقيقة • تصنيف: ${service.category}",
                                color = Slate400,
                                fontSize = 11.sp
                            )
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        Text(text = service.iconEmoji, fontSize = 24.sp)
                    }
                }
            }

            item {
                SectionHeader("2. اختر المصفف المفضل")
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    items(SupabaseRepository.availableStaff) { staff ->
                        val isSelected = staff.id == selectedStaff.id
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (isSelected) Cyan500.copy(alpha = 0.15f) else Slate900)
                                .border(
                                    1.dp,
                                    if (isSelected) Cyan500 else Slate800,
                                    RoundedCornerShape(12.dp)
                                )
                                .clickable { selectedStaff = staff }
                                .padding(horizontal = 14.dp, vertical = 10.dp)
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    text = staff.name,
                                    color = if (isSelected) Cyan400 else White,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = staff.role,
                                    color = Slate400,
                                    fontSize = 10.sp
                                )
                            }
                        }
                    }
                }
            }

            item {
                SectionHeader("3. اليوم والتاريخ")
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    items(dates) { datePair ->
                        val isSelected = datePair.first == selectedDate
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (isSelected) Emerald500.copy(alpha = 0.2f) else Slate900)
                                .border(
                                    1.dp,
                                    if (isSelected) Emerald500 else Slate800,
                                    RoundedCornerShape(12.dp)
                                )
                                .clickable { selectedDate = datePair.first }
                                .padding(horizontal = 16.dp, vertical = 10.dp)
                        ) {
                            Text(
                                text = datePair.second,
                                color = if (isSelected) Emerald400 else White,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }

            item {
                SectionHeader("4. الوقت المناسب")
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    items(timeSlots) { slot ->
                        val isSelected = slot == selectedTime
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(10.dp))
                                .background(if (isSelected) Amber500.copy(alpha = 0.2f) else Slate900)
                                .border(
                                    1.dp,
                                    if (isSelected) Amber500 else Slate800,
                                    RoundedCornerShape(10.dp)
                                )
                                .clickable { selectedTime = slot }
                                .padding(horizontal = 12.dp, vertical = 8.dp)
                        ) {
                            Text(
                                text = slot,
                                color = if (isSelected) Amber400 else White,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
            }

            item {
                SectionHeader("5. بيانات التواصل")

                OutlinedTextField(
                    value = customerName,
                    onValueChange = { customerName = it },
                    label = { Text("الاسم بالكامل") },
                    placeholder = { Text("مثال: محمد أحمد") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = White,
                        unfocusedTextColor = Slate200,
                        focusedBorderColor = Emerald500,
                        unfocusedBorderColor = Slate700,
                        focusedContainerColor = Slate900,
                        unfocusedContainerColor = Slate900
                    )
                )

                Spacer(modifier = Modifier.height(10.dp))

                OutlinedTextField(
                    value = customerPhone,
                    onValueChange = { customerPhone = it },
                    label = { Text("رقم الموبايل (لإرسال إشعار التأكيد)") },
                    placeholder = { Text("010xxxxxxxx") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = White,
                        unfocusedTextColor = Slate200,
                        focusedBorderColor = Emerald500,
                        unfocusedBorderColor = Slate700,
                        focusedContainerColor = Slate900,
                        unfocusedContainerColor = Slate900
                    )
                )

                Spacer(modifier = Modifier.height(10.dp))

                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("ملاحظات إضافية (اختياري)") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = White,
                        unfocusedTextColor = Slate200,
                        focusedBorderColor = Emerald500,
                        unfocusedBorderColor = Slate700,
                        focusedContainerColor = Slate900,
                        unfocusedContainerColor = Slate900
                    )
                )
            }

            if (errorMessage != null) {
                item {
                    Text(
                        text = errorMessage ?: "",
                        color = Red500,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            item {
                Button(
                    onClick = {
                        if (customerName.isBlank() || customerPhone.isBlank()) {
                            errorMessage = "يرجى كتابة الاسم ورقم الموبايل لإتمام الحجز"
                            return@Button
                        }
                        errorMessage = null
                        isSubmitting = true

                        scope.launch {
                            val res = Reservation(
                                id = "res_${System.currentTimeMillis()}",
                                branchId = selectedBranch?.id ?: "1",
                                branchName = selectedBranch?.name ?: "الفرع الرئيسي",
                                customerName = customerName.trim(),
                                phone = customerPhone.trim(),
                                date = selectedDate,
                                time = selectedTime,
                                serviceName = selectedService.name,
                                staffName = selectedStaff.name,
                                status = "pending",
                                notes = notes.takeIf { it.isNotBlank() },
                                createdAt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.ENGLISH).format(Date())
                            )
                            val result = SupabaseRepository.createReservation(res)
                            isSubmitting = false
                            if (result.isSuccess) {
                                showSuccessDialog = true
                            } else {
                                errorMessage = "حدث خطأ أثناء إرسال الحجز، يرجى المحاولة مرة أخرى."
                            }
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Emerald600),
                    enabled = !isSubmitting
                ) {
                    if (isSubmitting) {
                        CircularProgressIndicator(color = White, modifier = Modifier.size(24.dp))
                    } else {
                        Text(
                            text = "تأكيد طلب الحجز الفوري",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = White
                        )
                    }
                }
                Spacer(modifier = Modifier.height(28.dp))
            }
        }
    }

    if (showSuccessDialog) {
        AlertDialog(
            onDismissRequest = {
                showSuccessDialog = false
                onBookingSuccess()
            },
            title = {
                Text(
                    text = "🎉 تم استلام حجزك بنجاح!",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = White,
                    textAlign = TextAlign.Right,
                    modifier = Modifier.fillMaxWidth()
                )
            },
            text = {
                Column(horizontalAlignment = Alignment.End, modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "الخدمة: ${selectedService.name}",
                        color = Slate200,
                        fontSize = 14.sp
                    )
                    Text(
                        text = "الموعد: $selectedDate في تمام الساعة $selectedTime",
                        color = Emerald400,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "المصفف: ${selectedStaff.name}",
                        color = Slate200,
                        fontSize = 13.sp
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "تم إرسال الطلب لصالون RaiZon Pro وسيتواصل معك الكاشير أو تجد موعدك مؤكداً.",
                        color = Slate400,
                        fontSize = 12.sp,
                        textAlign = TextAlign.Right
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        showSuccessDialog = false
                        onBookingSuccess()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Emerald600)
                ) {
                    Text("حسناً، تم")
                }
            },
            containerColor = Slate900
        )
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        text = title,
        color = Slate300,
        fontSize = 14.sp,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.fillMaxWidth(),
        textAlign = TextAlign.Right
    )
    Spacer(modifier = Modifier.height(8.dp))
}
