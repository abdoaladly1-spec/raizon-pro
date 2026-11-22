package com.raizon.procashier.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Search
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
import com.raizon.procashier.data.Reservation
import com.raizon.procashier.data.SupabaseRepository
import com.raizon.procashier.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomerAppointmentsScreen(
    onBack: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val currentAuthUser = SupabaseRepository.currentUser
    var searchPhone by remember { mutableStateOf(currentAuthUser?.phone ?: "") }
    var reservations by remember { mutableStateOf<List<Reservation>>(emptyList()) }
    var isLoading by remember { mutableStateOf(false) }
    var hasSearched by remember { mutableStateOf(false) }

    fun search() {
        if (searchPhone.isBlank()) return
        scope.launch {
            isLoading = true
            hasSearched = true
            val res = SupabaseRepository.fetchReservations(searchPhone.trim())
            if (res.isSuccess) {
                reservations = res.getOrDefault(emptyList())
            }
            isLoading = false
        }
    }

    LaunchedEffect(Unit) {
        if (searchPhone.isNotBlank()) {
            search()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "متابعة حجوزاتي",
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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
        ) {
            // Phone input search box
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Button(
                    onClick = { search() },
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Emerald600),
                    modifier = Modifier.height(56.dp)
                ) {
                    Icon(Icons.Default.Search, contentDescription = "بحث")
                }

                Spacer(modifier = Modifier.width(10.dp))

                OutlinedTextField(
                    value = searchPhone,
                    onValueChange = { searchPhone = it },
                    label = { Text("أدخل رقم هاتفك") },
                    placeholder = { Text("010xxxxxxxx") },
                    modifier = Modifier.weight(1f),
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
            }

            Spacer(modifier = Modifier.height(20.dp))

            if (isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Emerald500)
                }
            } else if (hasSearched && reservations.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        text = "لا توجد حجوزات مسجلة بهذا الرقم",
                        color = Slate400,
                        fontSize = 14.sp
                    )
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(reservations) { item ->
                        ReservationCard(item)
                    }
                }
            }
        }
    }
}

@Composable
private fun ReservationCard(item: Reservation) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .border(1.dp, Slate800, RoundedCornerShape(14.dp)),
        colors = CardDefaults.cardColors(containerColor = Slate900)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.End
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                val (statusColor, statusText) = when (item.status) {
                    "confirmed" -> Pair(Emerald400, "تم التأكيد ✅")
                    "completed" -> Pair(Cyan400, "مكتمل 👍")
                    "cancelled" -> Pair(Red500, "ملغي ❌")
                    else -> Pair(Amber400, "قيد المراجعة ⏳")
                }

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(statusColor.copy(alpha = 0.15f))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = statusText,
                        color = statusColor,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                Text(
                    text = item.serviceName,
                    color = White,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "الموعد: ${item.date} • الساعة ${item.time}",
                color = Slate200,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium
            )

            Text(
                text = "المصفف: ${item.staffName}",
                color = Slate400,
                fontSize = 12.sp
            )

            if (!item.notes.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "ملاحظات: ${item.notes}",
                    color = Slate400,
                    fontSize = 11.sp
                )
            }
        }
    }
}
