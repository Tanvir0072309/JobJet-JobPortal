import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../context/AuthContext";

// Root layout: no bottom tabs, no theme-driven dark mode switching (JobJet is
// a fixed monochrome light theme per branding spec). Auth gating for each
// route group happens in the group's own layout (see (main)/_layout.tsx and
// login/register/forgot-password screens checking auth state themselves).
//
// SafeAreaProvider is required here so every screen can read safe-area
// insets (needed by TopBar/BottomTabBar to clear the status bar and the
// Android gesture/3-button nav bar). StatusBar is forced to "dark" content
// because the app background is pure white — left on "auto"/default it was
// rendering white icons/time on a white bar, making them invisible.
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="welcome" />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="(main)" />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
