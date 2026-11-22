package com.raizon.procashier.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.raizon.procashier.data.AppUser
import com.raizon.procashier.data.SupabaseRepository
import com.raizon.procashier.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AuthScreen(
    onLoginSuccess: (AppUser) -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    var isRegisterMode by remember { mutableStateOf(false) } // false = Login, true = Register Customer

    // Login Form State
    var loginIdentifier by remember { mutableStateOf("") }
    var loginPassword by remember { mutableStateOf("") }
    var showLoginPassword by remember { mutableStateOf(false) }

    // Register Form State (Customer Only)
    var regFirstName by remember { mutableStateOf("") }
    var regLastName by remember { mutableStateOf("") }
    var regEmailOrPhone by remember { mutableStateOf("") }
    var regPassword by remember { mutableStateOf("") }
    var regConfirmPassword by remember { mutableStateOf("") }
    var showRegPassword by remember { mutableStateOf(false) }
    var agreePolicy by remember { mutableStateOf(false) }
    var showPolicyDialog by remember { mutableStateOf(false) }

    // Status State
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var successMessage by remember { mutableStateOf<String?>(null) }

    val passwordsMatch = regPassword.isNotEmpty() && regPassword == regConfirmPassword

    Scaffold(
        containerColor = Slate950
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // App Branding Header
            Spacer(modifier = Modifier.height(16.dp))
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(RoundedCornerShape(22.dp))
                    .background(
                        Brush.linearGradient(
                            listOf(Emerald500, Teal400)
                        )
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.CloudSync,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(38.dp)
                )
            }

            Spacer(modifier = Modifier.height(14.dp))
            Text(
                text = "RaiZon Pro Cloud",
                color = Color.White,
                fontSize = 24.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 0.5.sp
            )
            Text(
                text = "النظام السحابي الموحد لإدارة الفروع والمبيعات والحجوزات",
                color = Slate400,
                fontSize = 12.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Segmented Switch: تسجيل الدخول / حساب عميل جديد
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Slate900)
                    .border(1.dp, Slate800, RoundedCornerShape(16.dp))
                    .padding(4.dp)
            ) {
                // Login Tab
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (!isRegisterMode) Emerald500 else Color.Transparent)
                        .clickable {
                            isRegisterMode = false
                            errorMessage = null
                            successMessage = null
                        }
                        .padding(vertical = 11.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "تسجيل الدخول",
                        color = if (!isRegisterMode) Color.White else Slate400,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                // Register Tab
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (isRegisterMode) Emerald500 else Color.Transparent)
                        .clickable {
                            isRegisterMode = true
                            errorMessage = null
                            successMessage = null
                        }
                        .padding(vertical = 11.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "حساب عميل جديد ✨",
                        color = if (isRegisterMode) Color.White else Slate400,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Error / Success Banners
            AnimatedVisibility(visible = errorMessage != null) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF451A1A)),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 16.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Warning,
                            contentDescription = null,
                            tint = Color(0xFFF87171),
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = errorMessage ?: "",
                            color = Color(0xFFFECACA),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }

            AnimatedVisibility(visible = successMessage != null) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF064E3B)),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 16.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = Emerald400,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = successMessage ?: "",
                            color = Color(0xFFA7F3D0),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }

            // -------------------------------------------------------------
            // MODE A: SIGN IN (مدير، كاشير، أو عميل)
            // -------------------------------------------------------------
            if (!isRegisterMode) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Slate900),
                    shape = RoundedCornerShape(20.dp),
                    border = CardDefaults.outlinedCardBorder().copy(brush = Brush.linearGradient(listOf(Slate800, Slate700))),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Text(
                            text = "مرحباً بعودتك",
                            color = Color.White,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "أدخل بيانات حسابك للمتابعة",
                            color = Slate400,
                            fontSize = 12.sp,
                            modifier = Modifier.padding(top = 2.dp, bottom = 18.dp)
                        )

                        // Identifier Field
                        OutlinedTextField(
                            value = loginIdentifier,
                            onValueChange = { loginIdentifier = it },
                            label = { Text("اسم المستخدم / البريد / الهاتف", fontSize = 12.sp) },
                            leadingIcon = {
                                Icon(Icons.Default.Person, contentDescription = null, tint = Slate400)
                            },
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedContainerColor = Slate800,
                                unfocusedContainerColor = Slate800,
                                focusedBorderColor = Emerald500,
                                unfocusedBorderColor = Slate700,
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White
                            ),
                            singleLine = true,
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(14.dp))

                        // Password Field
                        OutlinedTextField(
                            value = loginPassword,
                            onValueChange = { loginPassword = it },
                            label = { Text("كلمة المرور", fontSize = 12.sp) },
                            leadingIcon = {
                                Icon(Icons.Default.Lock, contentDescription = null, tint = Slate400)
                            },
                            trailingIcon = {
                                IconButton(onClick = { showLoginPassword = !showLoginPassword }) {
                                    Icon(
                                        imageVector = if (showLoginPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                        contentDescription = null,
                                        tint = Slate400
                                    )
                                }
                            },
                            visualTransformation = if (showLoginPassword) VisualTransformation.None else PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedContainerColor = Slate800,
                                unfocusedContainerColor = Slate800,
                                focusedBorderColor = Emerald500,
                                unfocusedBorderColor = Slate700,
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White
                            ),
                            singleLine = true,
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(22.dp))

                        // Submit Button
                        Button(
                            onClick = {
                                if (loginIdentifier.isBlank() || loginPassword.isBlank()) {
                                    errorMessage = "يرجى ملء جميع الحقول"
                                    return@Button
                                }
                                isLoading = true
                                errorMessage = null
                                coroutineScope.launch {
                                    val result = SupabaseRepository.login(loginIdentifier.trim(), loginPassword)
                                    isLoading = false
                                    result.fold(
                                        onSuccess = { user ->
                                            onLoginSuccess(user)
                                        },
                                        onFailure = { err ->
                                            errorMessage = err.message ?: "فشل تسجيل الدخول، تأكد من صحة البيانات"
                                        }
                                    )
                                }
                            },
                            enabled = !isLoading,
                            colors = ButtonDefaults.buttonColors(containerColor = Emerald500),
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp)
                        ) {
                            if (isLoading) {
                                CircularProgressIndicator(color = Color.White, modifier = Modifier.size(22.dp), strokeWidth = 2.dp)
                            } else {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text("تسجيل الدخول", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Icon(Icons.Default.ArrowBack, contentDescription = null, modifier = Modifier.size(18.dp))
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(18.dp))

                // Admin Notice Box
                Card(
                    colors = CardDefaults.cardColors(containerColor = Slate900.copy(alpha = 0.6f)),
                    shape = RoundedCornerShape(16.dp),
                    border = CardDefaults.outlinedCardBorder().copy(brush = Brush.linearGradient(listOf(Slate800, Slate800))),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.Top
                    ) {
                        Icon(
                            imageVector = Icons.Default.Info,
                            contentDescription = null,
                            tint = Amber500,
                            modifier = Modifier
                                .size(20.dp)
                                .padding(top = 2.dp)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = "تنويه أمني: حسابات المدراء والكاشير يتم إنشاؤها عبر سيستم الكاشير على جهاز الكمبيوتر فقط. يمكن للمدير تسجيل الدخول هنا ومتابعة كافة الفروع والفواتير لحظياً.",
                            color = Slate400,
                            fontSize = 11.sp,
                            lineHeight = 16.sp
                        )
                    }
                }
            }

            // -------------------------------------------------------------
            // MODE B: CUSTOMER SIGN UP (حساب عميل جديد للحجوزات فقط)
            // -------------------------------------------------------------
            if (isRegisterMode) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Slate900),
                    shape = RoundedCornerShape(20.dp),
                    border = CardDefaults.outlinedCardBorder().copy(brush = Brush.linearGradient(listOf(Slate800, Slate700))),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = "إنشاء حساب عميل",
                                color = Color.White,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "(حجوزات فقط)",
                                color = Emerald400,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Text(
                            text = "احجز مواعيدك وتابع حجوزاتك لدى كافة الفروع بسهولة",
                            color = Slate400,
                            fontSize = 12.sp,
                            modifier = Modifier.padding(top = 2.dp, bottom = 18.dp)
                        )

                        // First Name & Last Name (Row)
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            OutlinedTextField(
                                value = regFirstName,
                                onValueChange = { regFirstName = it },
                                label = { Text("الاسم الأول *", fontSize = 12.sp) },
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedContainerColor = Slate800,
                                    unfocusedContainerColor = Slate800,
                                    focusedBorderColor = Emerald500,
                                    unfocusedBorderColor = Slate700,
                                    focusedTextColor = Color.White,
                                    unfocusedTextColor = Color.White
                                ),
                                singleLine = true,
                                shape = RoundedCornerShape(14.dp),
                                modifier = Modifier.weight(1f)
                            )
                            OutlinedTextField(
                                value = regLastName,
                                onValueChange = { regLastName = it },
                                label = { Text("اسم العائلة *", fontSize = 12.sp) },
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedContainerColor = Slate800,
                                    unfocusedContainerColor = Slate800,
                                    focusedBorderColor = Emerald500,
                                    unfocusedBorderColor = Slate700,
                                    focusedTextColor = Color.White,
                                    unfocusedTextColor = Color.White
                                ),
                                singleLine = true,
                                shape = RoundedCornerShape(14.dp),
                                modifier = Modifier.weight(1f)
                            )
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        // Phone or Email
                        OutlinedTextField(
                            value = regEmailOrPhone,
                            onValueChange = { regEmailOrPhone = it },
                            label = { Text("البريد الإلكتروني أو رقم الهاتف *", fontSize = 12.sp) },
                            leadingIcon = {
                                Icon(Icons.Default.Phone, contentDescription = null, tint = Slate400)
                            },
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedContainerColor = Slate800,
                                unfocusedContainerColor = Slate800,
                                focusedBorderColor = Emerald500,
                                unfocusedBorderColor = Slate700,
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White
                            ),
                            singleLine = true,
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(14.dp))

                        // Password
                        OutlinedTextField(
                            value = regPassword,
                            onValueChange = { regPassword = it },
                            label = { Text("كلمة المرور (6 خانات على الأقل) *", fontSize = 12.sp) },
                            leadingIcon = {
                                Icon(Icons.Default.Lock, contentDescription = null, tint = Slate400)
                            },
                            trailingIcon = {
                                IconButton(onClick = { showRegPassword = !showRegPassword }) {
                                    Icon(
                                        imageVector = if (showRegPassword) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                        contentDescription = null,
                                        tint = Slate400
                                    )
                                }
                            },
                            visualTransformation = if (showRegPassword) VisualTransformation.None else PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedContainerColor = Slate800,
                                unfocusedContainerColor = Slate800,
                                focusedBorderColor = Emerald500,
                                unfocusedBorderColor = Slate700,
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White
                            ),
                            singleLine = true,
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(14.dp))

                        // Confirm Password
                        OutlinedTextField(
                            value = regConfirmPassword,
                            onValueChange = { regConfirmPassword = it },
                            label = { Text("تأكيد كلمة المرور *", fontSize = 12.sp) },
                            leadingIcon = {
                                Icon(Icons.Default.LockReset, contentDescription = null, tint = Slate400)
                            },
                            trailingIcon = {
                                if (regConfirmPassword.isNotEmpty()) {
                                    Icon(
                                        imageVector = if (passwordsMatch) Icons.Default.CheckCircle else Icons.Default.Error,
                                        contentDescription = null,
                                        tint = if (passwordsMatch) Emerald400 else Color(0xFFF87171)
                                    )
                                }
                            },
                            visualTransformation = if (showRegPassword) VisualTransformation.None else PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedContainerColor = Slate800,
                                unfocusedContainerColor = Slate800,
                                focusedBorderColor = if (regConfirmPassword.isEmpty()) Emerald500 else if (passwordsMatch) Emerald500 else Color(0xFFF87171),
                                unfocusedBorderColor = Slate700,
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White
                            ),
                            singleLine = true,
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(14.dp))

                        // Privacy Policy Agreement
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { agreePolicy = !agreePolicy }
                                .padding(vertical = 4.dp)
                        ) {
                            Checkbox(
                                checked = agreePolicy,
                                onCheckedChange = { agreePolicy = it },
                                colors = CheckboxDefaults.colors(
                                    checkedColor = Emerald500,
                                    uncheckedColor = Slate600
                                )
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "أوافق على ",
                                color = Slate400,
                                fontSize = 12.sp
                            )
                            Text(
                                text = "سياسة الخصوصية وحماية البيانات",
                                color = Emerald400,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.clickable { showPolicyDialog = true }
                            )
                        }

                        Spacer(modifier = Modifier.height(20.dp))

                        // Submit Button
                        Button(
                            onClick = {
                                if (regFirstName.isBlank() || regLastName.isBlank() || regEmailOrPhone.isBlank() || regPassword.isBlank()) {
                                    errorMessage = "يرجى استكمال كافة الحقول المطلوبة"
                                    return@Button
                                }
                                if (regPassword.length < 6) {
                                    errorMessage = "كلمة المرور يجب أن لا تقل عن 6 أحرف أو أرقام"
                                    return@Button
                                }
                                if (!passwordsMatch) {
                                    errorMessage = "كلمتا المرور غير متطابقتين"
                                    return@Button
                                }
                                if (!agreePolicy) {
                                    errorMessage = "يجب الموافقة على سياسة الخصوصية للمتابعة"
                                    return@Button
                                }

                                isLoading = true
                                errorMessage = null
                                coroutineScope.launch {
                                    val result = SupabaseRepository.registerCustomer(
                                        firstName = regFirstName.trim(),
                                        lastName = regLastName.trim(),
                                        emailOrPhone = regEmailOrPhone.trim(),
                                        password = regPassword
                                    )
                                    isLoading = false
                                    result.fold(
                                        onSuccess = { user ->
                                            successMessage = "تم إنشاء حساب العميل بنجاح! جاري الدخول..."
                                            onLoginSuccess(user)
                                        },
                                        onFailure = { err ->
                                            errorMessage = err.message ?: "حدث خطأ أثناء إنشاء الحساب"
                                        }
                                    )
                                }
                            },
                            enabled = !isLoading && passwordsMatch && agreePolicy,
                            colors = ButtonDefaults.buttonColors(containerColor = Emerald500),
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp)
                        ) {
                            if (isLoading) {
                                CircularProgressIndicator(color = Color.White, modifier = Modifier.size(22.dp), strokeWidth = 2.dp)
                            } else {
                                Text("ابدأ الآن ✨", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }

    // Privacy Policy Dialog
    if (showPolicyDialog) {
        AlertDialog(
            onDismissRequest = { showPolicyDialog = false },
            title = {
                Text("سياسة الخصوصية وحماية البيانات", fontWeight = FontWeight.Bold, color = Color.White)
            },
            text = {
                Column(
                    modifier = Modifier
                        .verticalScroll(rememberScrollState())
                        .padding(vertical = 8.dp)
                ) {
                    Text(
                        text = "1. سرية البيانات:\nنلتزم بحماية بياناتك الشخصية (الاسم، الهاتف، وتفاصيل الحجوزات) وتشفيرها، ولن يتم مشاركتها مع أي أطراف ثالثة.\n\n" +
                                "2. صلاحيات الحساب:\nحساب العميل مخصص حصرياً لإجراء وتتبع الحجوزات وإدارة المواعيد، ولا يملك أي وصول إلى البيانات المالية أو سجلات الكاشير.\n\n" +
                                "3. حماية العمليات:\nيتم تأمين كافة الاتصالات بقواعد أمان Row Level Security (RLS) لضمان الخصوصية التامة بين الفروع والمستخدمين.",
                        color = Slate300,
                        fontSize = 13.sp,
                        lineHeight = 20.sp
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        agreePolicy = true
                        showPolicyDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Emerald500)
                ) {
                    Text("موافق ومتابعة")
                }
            },
            dismissButton = {
                TextButton(onClick = { showPolicyDialog = false }) {
                    Text("إغلاق", color = Slate400)
                }
            },
            containerColor = Slate900,
            shape = RoundedCornerShape(20.dp)
        )
    }
}
