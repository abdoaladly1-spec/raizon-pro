package com.raizon.procashier.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val DarkColorScheme = darkColorScheme(
    primary = Emerald500,
    onPrimary = White,
    primaryContainer = Emerald600,
    secondary = Amber500,
    onSecondary = White,
    tertiary = Cyan500,
    background = Slate950,
    surface = Slate900,
    surfaceVariant = Slate800,
    onBackground = Slate100,
    onSurface = Slate100,
    onSurfaceVariant = Slate400,
    outline = Slate700
)

@Composable
fun RaiZonProTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography = Typography,
        content = content
    )
}
