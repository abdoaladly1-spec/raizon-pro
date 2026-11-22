import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'repositories/supabase_repository.dart';
import 'screens/auth_screen.dart';
import 'screens/home_screen.dart';
import 'screens/manager_dashboard_screen.dart';
import 'theme/app_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const FlareOneApp());
}

class FlareOneApp extends StatelessWidget {
  const FlareOneApp({super.key});

  @override
  Widget build(BuildContext context) {
    Widget initialScreen = const AuthScreen();
    final user = SupabaseRepository.currentUser;
    if (user != null) {
      initialScreen = user.isAdmin ? const ManagerDashboardScreen() : const HomeScreen();
    }

    return MaterialApp(
      title: 'فلير وان - Flare One',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('ar', 'EG'),
      ],
      locale: const Locale('ar', 'EG'),
      home: initialScreen,
    );
  }
}
