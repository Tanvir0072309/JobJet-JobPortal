import React from "react";
import { View, StyleSheet } from "react-native";
import { Redirect, Slot } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { TopBar } from "../../components/TopBar";
import { BottomTabBar } from "../../components/BottomTabBar";
import { LoadingState } from "../../components/LoadingState";
import { colors } from "../../constants/jobjetTheme";

export default function MainLayout() {
  const { isAuthenticated, isBootstrapping, user } = useAuth();

  if (isBootstrapping) return <LoadingState label="Loading JobJet..." />;
  if (!isAuthenticated) return <Redirect href="/login" />;
  // Onboarding isn't considered complete until Gmail is connected (see
  // connect-gmail.tsx) - every screen under (main) is gated on this, not
  // just the ones that send email, so there's no route where a
  // half-onboarded account can wander around the app.
  if (!user?.gmailConnected) return <Redirect href="/connect-gmail" />;

  return (
    <View style={styles.container}>
      <TopBar />
      <View style={styles.content}>
        <Slot />
      </View>
      <BottomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 },
});
