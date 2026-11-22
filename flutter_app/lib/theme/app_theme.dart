import 'package:flutter/material.dart';

class AppColors {
  static const Color slate950 = Color(0xFF0B0F19);
  static const Color slate900 = Color(0xFF0F172A);
  static const Color slate800 = Color(0xFF1E293B);
  static const Color slate700 = Color(0xFF334155);
  static const Color slate600 = Color(0xFF475569);
  static const Color slate400 = Color(0xFF94A3B8);
  static const Color slate300 = Color(0xFFCBD5E1);
  static const Color slate200 = Color(0xFFE2E8F0);
  static const Color slate100 = Color(0xFFF1F5F9);
  static const Color white = Color(0xFFFFFFFF);

  static const Color emerald500 = Color(0xFF10B981);
  static const Color emerald600 = Color(0xFF059669);
  static const Color emerald400 = Color(0xFF34D399);

  static const Color amber500 = Color(0xFFF59E0B);
  static const Color amber400 = Color(0xFFFBBF24);

  static const Color cyan500 = Color(0xFF06B6D4);
  static const Color cyan400 = Color(0xFF22D3EE);

  static const Color red500 = Color(0xFFEF4444);
  static const Color purple500 = Color(0xFF8B5CF6);
}

class AppTheme {
  static ThemeData darkTheme = ThemeData(
    brightness: Brightness.dark,
    scaffoldBackgroundColor: AppColors.slate950,
    primaryColor: AppColors.emerald500,
    colorScheme: const ColorScheme.dark(
      primary: AppColors.emerald500,
      surface: AppColors.slate900,
      background: AppColors.slate950,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.slate900,
      elevation: 0,
      centerTitle: false,
      iconTheme: IconThemeData(color: AppColors.white),
    ),
    fontFamily: 'Cairo',
  );
}
