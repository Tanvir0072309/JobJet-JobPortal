import React from "react";
import { Stack } from "expo-router";
import { AuthProvider } from "../context/AuthContext";

// Root layout: no bottom tabs, no theme-driven dark mode switching (JobJet is
// a fixed monochrome light theme per branding spec). Auth gating for each
// route group happens in the group's own layout (see (main)/_layout.tsx and
// login/register/forgot-password screens checking auth state themselves).
export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="(main)" />
      </Stack>
    </AuthProvider>
  );
}
