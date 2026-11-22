package com.raizon.procashier.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.raizon.procashier.ui.theme.*

@Composable
fun HomeScreen(
    onNavigateToManager: () -> Unit,
    onNavigateToCustomerBooking: () -> Unit,
    onNavigateToMyAppointments: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Slate950)
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(24.dp))

        // Live Cloud Connection Pill
        Row(
            modifier = Modifier
                .clip(CircleShape)
                .background(Emerald500.copy(alpha = 0.15f))
                .border(1.dp, Emerald500.copy(alpha = 0.4f), CircleShape)
                .padding(horizontal = 14.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(Emerald500)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "سحابة متصلة لحظياً (Supabase)",
                color = Emerald400,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium
            )
        }

        Spacer(modifier = Modifier.height(20.dp))

        // App Title
        Text(
            text = "RaiZon Pro",
            color = White,
            fontSize = 32.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 1.sp
        )
        Text(
            text = "النظام السحابي لإدارة الصالون والكاشير والحجوزات",
            color = Slate400,
            fontSize = 14.sp,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(36.dp))

        Text(
            text = "اختر وجهة الدخول",
            color = Slate200,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Right
        )

        Spacer(modifier = Modifier.height(14.dp))

        // Manager Portal Card
        PortalCard(
            title = "لوحة تحكم المدير اللحظية",
            subtitle = "متابعة المبيعات المباشرة، درج الكاش، الحسابات البنكية، والديون",
            icon = Icons.Default.Assessment,
            badge = "للإدارة والمالك",
            accentColor = Emerald500,
            onClick = onNavigateToManager
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Customer Booking Card
        PortalCard(
            title = "بوابة حجز العملاء",
            subtitle = "حجز موعد قص وتصفيف، اختيار المصفف المفضل والتوقيت المناسب",
            icon = Icons.Default.CalendarMonth,
            badge = "للزبائن والعملاء",
            accentColor = Cyan500,
            onClick = onNavigateToCustomerBooking
        )

        Spacer(modifier = Modifier.height(16.dp))

        // My Appointments Track Card
        PortalCard(
            title = "متابعة حجوزاتي السابقة",
            subtitle = "استعلام فوري برقم الموبايل عن حالة الموعد وتفاصيله",
            icon = Icons.Default.EventAvailable,
            badge = "استعلام سريع",
            accentColor = Amber500,
            onClick = onNavigateToMyAppointments
        )

        Spacer(modifier = Modifier.weight(1f))

        // Footer
        Text(
            text = "نسخة الهاتف 1.0 • متوافقة مع الكاشير السحابي",
            color = Slate600,
            fontSize = 12.sp
        )
    }
}

@Composable
private fun PortalCard(
    title: String,
    subtitle: String,
    icon: ImageVector,
    badge: String,
    accentColor: Color,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .border(1.dp, Slate800, RoundedCornerShape(18.dp))
            .clickable { onClick() },
        colors = CardDefaults.cardColors(containerColor = Slate900)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.ChevronLeft,
                contentDescription = null,
                tint = Slate400,
                modifier = Modifier.size(24.dp)
            )

            Spacer(modifier = Modifier.width(12.dp))

            Column(
                modifier = Modifier.weight(1f),
                horizontalAlignment = Alignment.End
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(accentColor.copy(alpha = 0.15f))
                            .padding(horizontal = 8.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = badge,
                            color = accentColor,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Spacer(modifier = Modifier.width(8.dp))

                    Text(
                        text = title,
                        color = White,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Right
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = subtitle,
                    color = Slate400,
                    fontSize = 12.sp,
                    lineHeight = 16.sp,
                    textAlign = TextAlign.Right
                )
            }

            Spacer(modifier = Modifier.width(14.dp))

            Box(
                modifier = Modifier
                    .size(50.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(accentColor.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = accentColor,
                    modifier = Modifier.size(28.dp)
                )
            }
        }
    }
}
