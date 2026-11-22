package com.raizon.procashier.data

import com.google.gson.annotations.SerializedName

data class Branch(
    @SerializedName("id") val id: String = "",
    @SerializedName("name") val name: String = "",
    @SerializedName("address") val address: String? = null,
    @SerializedName("phone") val phone: String? = null,
    @SerializedName("active") val active: Boolean = true
)

data class AppUser(
    @SerializedName("id") val id: String = "",
    @SerializedName("username") val username: String = "",
    @SerializedName("name") val name: String = "",
    @SerializedName("email") val email: String? = null,
    @SerializedName("phone") val phone: String? = null,
    @SerializedName("role") val role: String = "customer", // "admin", "manager", "cashier", "customer"
    @SerializedName("location_id") val locationId: String? = null,
    @SerializedName("permissions") val permissions: List<String> = emptyList(),
    @SerializedName("password_hash") val passwordHash: String? = null,
    @SerializedName("password_salt") val passwordSalt: String? = null
) {
    val isAdmin: Boolean get() = role.equals("admin", ignoreCase = true) || role.equals("manager", ignoreCase = true)
    val isCustomer: Boolean get() = role.equals("customer", ignoreCase = true)
}

data class Invoice(
    @SerializedName("client_key") val clientKey: String? = null,
    @SerializedName("invoice_number") val invoiceNumber: String = "",
    @SerializedName("branch_id") val branchId: String? = null,
    @SerializedName("branch_name") val branchName: String? = null,
    @SerializedName("customer_id") val customerId: String? = null,
    @SerializedName("customer_name") val customerName: String? = null,
    @SerializedName("phone") val phone: String? = null,
    @SerializedName("subtotal") val subtotal: Double = 0.0,
    @SerializedName("discount_percent") val discountPercent: Double = 0.0,
    @SerializedName("tax_percent") val taxPercent: Double = 0.0,
    @SerializedName("total") val total: Double = 0.0,
    @SerializedName("payment_method") val paymentMethod: String = "cash",
    @SerializedName("status") val status: String = "paid",
    @SerializedName("notes") val notes: String? = null,
    @SerializedName("staff_name") val staffName: String? = null,
    @SerializedName("created_at") val createdAt: String = ""
)

data class Customer(
    @SerializedName("id") val id: String = "",
    @SerializedName("name") val name: String = "",
    @SerializedName("phone") val phone: String? = null,
    @SerializedName("balance") val balance: Double = 0.0,
    @SerializedName("credit_limit") val creditLimit: Double = 2000.0,
    @SerializedName("notes") val notes: String? = null,
    @SerializedName("updated_at") val updatedAt: String? = null
)

data class Reservation(
    @SerializedName("id") val id: String = "",
    @SerializedName("customer_id") val customerId: String? = null,
    @SerializedName("customer_name") val customerName: String = "",
    @SerializedName("phone") val phone: String = "",
    @SerializedName("branch_id") val branchId: String? = null,
    @SerializedName("branch_name") val branchName: String? = null,
    @SerializedName("date") val date: String = "",
    @SerializedName("time") val time: String = "",
    @SerializedName("service_name") val serviceName: String = "",
    @SerializedName("staff_name") val staffName: String = "",
    @SerializedName("status") val status: String = "pending", // pending, confirmed, completed, cancelled
    @SerializedName("notes") val notes: String? = null,
    @SerializedName("created_at") val createdAt: String? = null
)

data class Expense(
    @SerializedName("id") val id: String = "",
    @SerializedName("branch_id") val branchId: String? = null,
    @SerializedName("title") val title: String = "",
    @SerializedName("amount") val amount: Double = 0.0,
    @SerializedName("category") val category: String = "عام",
    @SerializedName("date") val date: String = "",
    @SerializedName("method") val method: String = "cash"
)

data class BarberService(
    val id: String,
    val name: String,
    val durationMinutes: Int,
    val price: Double,
    val category: String,
    val iconEmoji: String
)

data class StaffMember(
    val id: String,
    val name: String,
    val role: String,
    val isAvailable: Boolean = true
)

data class DashboardStats(
    val todaySales: Double = 0.0,
    val todayInvoicesCount: Int = 0,
    val cashDrawer: Double = 0.0,
    val bankInsta: Double = 0.0,
    val wallets: Double = 0.0,
    val debtorBalance: Double = 0.0,
    val todayExpenses: Double = 0.0
)
