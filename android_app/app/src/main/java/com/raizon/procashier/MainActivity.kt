package com.raizon.procashier

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.raizon.procashier.data.SupabaseRepository
import com.raizon.procashier.ui.screens.*
import com.raizon.procashier.ui.theme.RaiZonProTheme
import com.raizon.procashier.ui.theme.Slate950

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // تهيئة مستودع سوبابيز وإدارة الجلسات المخزنة محلياً
        SupabaseRepository.init(applicationContext)

        setContent {
            RaiZonProTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Slate950
                ) {
                    RaiZonApp()
                }
            }
        }
    }
}

@Composable
fun RaiZonApp() {
    val navController = rememberNavController()
    val currentUser = SupabaseRepository.currentUser

    // تحديد شاشة البداية الذكية بناءً على حالة تسجيل الدخول ودور المستخدم
    val startDestination = remember {
        when {
            currentUser == null -> "auth"
            currentUser.isAdmin -> "manager_dashboard"
            else -> "home"
        }
    }

    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        composable("auth") {
            AuthScreen(
                onLoginSuccess = { user ->
                    if (user.isAdmin) {
                        navController.navigate("manager_dashboard") {
                            popUpTo("auth") { inclusive = true }
                        }
                    } else {
                        navController.navigate("home") {
                            popUpTo("auth") { inclusive = true }
                        }
                    }
                }
            )
        }

        composable("home") {
            HomeScreen(
                onNavigateToManager = { navController.navigate("manager_dashboard") },
                onNavigateToCustomerBooking = { navController.navigate("customer_booking") },
                onNavigateToMyAppointments = { navController.navigate("customer_appointments") }
            )
        }

        composable("manager_dashboard") {
            ManagerDashboardScreen(
                onBack = {
                    if (currentUser?.isAdmin == true && navController.previousBackStackEntry == null) {
                        // If admin opened app directly to dashboard, logout when backing out
                        SupabaseRepository.logout()
                        navController.navigate("auth") {
                            popUpTo(0) { inclusive = true }
                        }
                    } else {
                        navController.popBackStack()
                    }
                },
                onLogout = {
                    navController.navigate("auth") {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }

        composable("customer_booking") {
            CustomerBookingScreen(
                onBack = { navController.popBackStack() },
                onBookingSuccess = {
                    navController.popBackStack()
                }
            )
        }

        composable("customer_appointments") {
            CustomerAppointmentsScreen(
                onBack = { navController.popBackStack() }
            )
        }
    }
}
