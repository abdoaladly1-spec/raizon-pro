package com.raizon.procashier.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.raizon.procashier.data.*
import com.raizon.procashier.ui.theme.*
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ManagerDashboardScreen(
    onBack: () -> Unit,
    onLogout: () -> Unit = onBack
) {
    val scope = rememberCoroutineScope()
    var isLoading by remember { mutableStateOf(true) }
    var stats by remember { mutableStateOf(DashboardStats()) }
    var invoices by remember { mutableStateOf<List<Invoice>>(emptyList()) }
    var reservations by remember { mutableStateOf<List<Reservation>>(emptyList()) }
    var branches by remember { mutableStateOf<List<Branch>>(emptyList()) }
    var selectedBranchId by remember { mutableStateOf<String?>(null) }
    var activeTab by remember { mutableStateOf(0) } // 0: نظرة عامة وفواتير, 1: الحجوزات الواردة

    fun loadData() {
        scope.launch {
            isLoading = true
            // Load branches if not loaded
            val branchRes = SupabaseRepository.fetchBranches()
            if (branchRes.isSuccess) {
                branches = branchRes.getOrDefault(emptyList())
            }

            val statsRes = SupabaseRepository.fetchDashboardStats(selectedBranchId)
            if (statsRes.isSuccess) {
                stats = statsRes.getOrDefault(DashboardStats())
            }

            val invRes = SupabaseRepository.fetchRecentInvoices(40, selectedBranchId)
            if (invRes.isSuccess) {
                invoices = invRes.getOrDefault(emptyList())
            }

            val resRes = SupabaseRepository.fetchReservations(null, selectedBranchId)
            if (resRes.isSuccess) {
                reservations = resRes.getOrDefault(emptyList())
            }
            isLoading = false
        }
    }

    LaunchedEffect(selectedBranchId) {
        loadData()
    }

    val currencyFormat = remember {
        val format = NumberFormat.getNumberInstance(Locale.ENGLISH)
        format.maximumFractionDigits = 0
        format
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column(horizontalAlignment = Alignment.End, modifier = Modifier.fillMaxWidth()) {
                        Text(
                            text = "لوحة المدير اللحظية",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = White
                        )
                        Text(
                            text = "متابعة مباشرة عبر السحابة",
                            fontSize = 12.sp,
                            color = Emerald400
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "رجوع", tint = White)
                    }
                },
                actions = {
                    IconButton(onClick = { loadData() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "تحديث", tint = Emerald400)
                    }
                    IconButton(onClick = {
                        SupabaseRepository.logout()
                        onLogout()
                    }) {
                        Icon(Icons.Default.ExitToApp, contentDescription = "تسجيل خروج", tint = Red500)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Slate900)
            )
        },
        containerColor = Slate950
    ) { padding ->
        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Emerald500)
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // Branch Selector Horizontal Filter Chips
                item {
                    Spacer(modifier = Modifier.height(4.dp))
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Slate900),
                        shape = RoundedCornerShape(16.dp),
                        border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.Brush.linearGradient(listOf(Slate800, Slate800))),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = if (selectedBranchId == null) "عرض كافة الفروع المتصلة" else "بيانات الفرع المحدد",
                                    color = Emerald400,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "تصفية حسب الفرع:",
                                    color = Slate400,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            androidx.compose.foundation.lazy.LazyRow(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                item {
                                    val isSelected = selectedBranchId == null
                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(10.dp))
                                            .background(if (isSelected) Emerald500 else Slate800)
                                            .border(1.dp, if (isSelected) Emerald400 else Slate700, RoundedCornerShape(10.dp))
                                            .clickable { selectedBranchId = null }
                                            .padding(horizontal = 14.dp, vertical = 6.dp)
                                    ) {
                                        Text(
                                            text = "جميع الفروع",
                                            color = if (isSelected) White else Slate300,
                                            fontSize = 12.sp,
                                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                                        )
                                    }
                                }

                                items(branches) { branch ->
                                    val isSelected = selectedBranchId == branch.id
                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(10.dp))
                                            .background(if (isSelected) Emerald500 else Slate800)
                                            .border(1.dp, if (isSelected) Emerald400 else Slate700, RoundedCornerShape(10.dp))
                                            .clickable { selectedBranchId = branch.id }
                                            .padding(horizontal = 14.dp, vertical = 6.dp)
                                    ) {
                                        Text(
                                            text = branch.name,
                                            color = if (isSelected) White else Slate300,
                                            fontSize = 12.sp,
                                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                item {
                    Spacer(modifier = Modifier.height(4.dp))
                    // Top Hero Card: Today's Revenue
                    HeroSalesCard(
                        amount = currencyFormat.format(stats.todaySales),
                        invoicesCount = stats.todayInvoicesCount
                    )
                }

                item {
                    // Row 1: Cash Drawer + Bank/InstaPay
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        MetricCard(
                            modifier = Modifier.weight(1f),
                            title = "رصيد بنكي / انستا",
                            amount = "${currencyFormat.format(stats.bankInsta)} ج.م",
                            tag = "لحظي",
                            accentColor = Cyan500,
                            icon = Icons.Default.CreditCard
                        )
                        MetricCard(
                            modifier = Modifier.weight(1f),
                            title = "درج النقدية الفعلي",
                            amount = "${currencyFormat.format(stats.cashDrawer)} ج.م",
                            tag = "كاش",
                            accentColor = Emerald500,
                            icon = Icons.Default.AccountBalanceWallet
                        )
                    }
                }

                item {
                    // Row 2: Wallets + Debtors
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        MetricCard(
                            modifier = Modifier.weight(1f),
                            title = "بطاقة المدينون (الآجل)",
                            amount = "${currencyFormat.format(stats.debtorBalance)} ج.م",
                            tag = "ديون",
                            accentColor = Red500,
                            icon = Icons.Default.People
                        )
                        MetricCard(
                            modifier = Modifier.weight(1f),
                            title = "المحافظ الإلكترونية",
                            amount = "${currencyFormat.format(stats.wallets)} ج.م",
                            tag = "فودافون كاش",
                            accentColor = Amber500,
                            icon = Icons.Default.PhoneAndroid
                        )
                    }
                }

                item {
                    // Row 3: Today's Expenses Card
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .border(1.dp, Slate800, RoundedCornerShape(14.dp)),
                        colors = CardDefaults.cardColors(containerColor = Slate900)
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "${currencyFormat.format(stats.todayExpenses)} ج.م",
                                color = Red500,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.weight(1f))
                            Column(horizontalAlignment = Alignment.End) {
                                Text(
                                    text = "مصاريف اليوم",
                                    color = Slate200,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                                Text(
                                    text = "المصروفات المسجلة اليوم",
                                    color = Slate400,
                                    fontSize = 11.sp
                                )
                            }
                        }
                    }
                }

                item {
                    // Navigation Tabs between Invoices and Reservations
                    TabRow(
                        selectedTabIndex = activeTab,
                        containerColor = Slate900,
                        contentColor = White,
                        modifier = Modifier.clip(RoundedCornerShape(12.dp))
                    ) {
                        Tab(
                            selected = activeTab == 0,
                            onClick = { activeTab = 0 },
                            text = { Text("آخر الفواتير (${invoices.size})", fontWeight = FontWeight.Bold) }
                        )
                        Tab(
                            selected = activeTab == 1,
                            onClick = { activeTab = 1 },
                            text = { Text("حجوزات العملاء (${reservations.size})", fontWeight = FontWeight.Bold) }
                        )
                    }
                }

                if (activeTab == 0) {
                    if (invoices.isEmpty()) {
                        item {
                            EmptyState(message = "لا توجد فواتير مسجلة اليوم حتى الآن")
                        }
                    } else {
                        items(invoices) { inv ->
                            InvoiceItemRow(inv)
                        }
                    }
                } else {
                    if (reservations.isEmpty()) {
                        item {
                            EmptyState(message = "لا توجد حجوزات واردة حالياً")
                        }
                    } else {
                        items(reservations) { res ->
                            ReservationAdminRow(
                                reservation = res,
                                onConfirm = {
                                    scope.launch {
                                        SupabaseRepository.updateReservationStatus(res.id, "confirmed")
                                        loadData()
                                    }
                                },
                                onCancel = {
                                    scope.launch {
                                        SupabaseRepository.updateReservationStatus(res.id, "cancelled")
                                        loadData()
                                    }
                                }
                            )
                        }
                    }
                }

                item {
                    Spacer(modifier = Modifier.height(24.dp))
                }
            }
        }
    }
}

@Composable
private fun HeroSalesCard(amount: String, invoicesCount: Int) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .border(1.dp, Emerald500.copy(alpha = 0.3f), RoundedCornerShape(18.dp)),
        colors = CardDefaults.cardColors(containerColor = Slate900)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            horizontalAlignment = Alignment.End
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(Emerald500.copy(alpha = 0.15f))
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "$invoicesCount فاتورة اليوم",
                        color = Emerald400,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                Text(
                    text = "مبيعات اليوم الإجمالية",
                    color = Slate400,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(verticalAlignment = Alignment.Bottom) {
                Text(
                    text = "ج.م",
                    color = Emerald500,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(end = 6.dp, bottom = 4.dp)
                )
                Text(
                    text = amount,
                    color = Emerald400,
                    fontSize = 34.sp,
                    fontWeight = FontWeight.Black
                )
            }
        }
    }
}

@Composable
private fun MetricCard(
    modifier: Modifier = Modifier,
    title: String,
    amount: String,
    tag: String,
    accentColor: Color,
    icon: ImageVector
) {
    Card(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .border(1.dp, Slate800, RoundedCornerShape(16.dp)),
        colors = CardDefaults.cardColors(containerColor = Slate900)
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            horizontalAlignment = Alignment.End
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(accentColor.copy(alpha = 0.15f))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(text = tag, color = accentColor, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }

                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(accentColor.copy(alpha = 0.15f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(imageVector = icon, contentDescription = null, tint = accentColor, modifier = Modifier.size(18.dp))
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            Text(
                text = title,
                color = Slate400,
                fontSize = 11.sp,
                textAlign = TextAlign.Right
            )

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = amount,
                color = White,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun InvoiceItemRow(invoice: Invoice) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .border(1.dp, Slate800, RoundedCornerShape(12.dp)),
        colors = CardDefaults.cardColors(containerColor = Slate900)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "${invoice.total} ج.م",
                color = Amber400,
                fontSize = 15.sp,
                fontWeight = FontWeight.Black
            )

            Spacer(modifier = Modifier.weight(1f))

            Column(horizontalAlignment = Alignment.End) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "#${invoice.invoiceNumber}",
                        color = Amber500,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = invoice.customerName ?: "عميل نقدي",
                        color = White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                Spacer(modifier = Modifier.height(3.dp))

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = invoice.createdAt.take(16).replace("T", " "),
                        color = Slate400,
                        fontSize = 11.sp
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "• ${invoice.paymentMethod}",
                        color = Emerald400,
                        fontSize = 11.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun ReservationAdminRow(
    reservation: Reservation,
    onConfirm: () -> Unit,
    onCancel: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .border(1.dp, Slate800, RoundedCornerShape(12.dp)),
        colors = CardDefaults.cardColors(containerColor = Slate900)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            horizontalAlignment = Alignment.End
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                val statusBg = when (reservation.status) {
                    "confirmed" -> Emerald500
                    "cancelled" -> Red500
                    else -> Amber500
                }
                val statusText = when (reservation.status) {
                    "confirmed" -> "مؤكد"
                    "cancelled" -> "ملغي"
                    else -> "قيد المراجعة"
                }

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(statusBg.copy(alpha = 0.2f))
                        .padding(horizontal = 8.dp, vertical = 2.dp)
                ) {
                    Text(text = statusText, color = statusBg, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }

                Text(
                    text = reservation.customerName,
                    color = White,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(6.dp))

            Text(
                text = "الخدمة: ${reservation.serviceName} | المصفف: ${reservation.staffName}",
                color = Slate300,
                fontSize = 13.sp
            )

            Text(
                text = "الموعد: ${reservation.date} الساعة ${reservation.time} | هاتف: ${reservation.phone}",
                color = Slate400,
                fontSize = 12.sp
            )

            if (reservation.status == "pending") {
                Spacer(modifier = Modifier.height(10.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = onConfirm,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = Emerald600),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("تأكيد الحجز", color = White, fontSize = 12.sp)
                    }

                    OutlinedButton(
                        onClick = onCancel,
                        modifier = Modifier.weight(1f),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Red500),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("إلغاء", color = Red500, fontSize = 12.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyState(message: String) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 36.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(text = message, color = Slate400, fontSize = 14.sp)
    }
}
