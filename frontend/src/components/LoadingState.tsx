import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Button } from "./Button";
import { colors, spacing, typography } from "../constants/jobjetTheme";

// Background-removed JobJet mark (transparent PNG) — used on the startup /
// bootstrapping screen so the logo sits directly on the app background with
// no colored square behind it.
const startupLogo = require("../../assets/images/jobjet-logo-transparent.png");

// Full-screen variant used specifically while the app is starting up
// (isBootstrapping in AuthContext), with the logo centered on screen.
export function StartupLoadingState({ label = "Starting JobJet..." }: { label?: string }) {
  return (
    <View style={styles.startupContainer}>
      <Image source={startupLogo} style={styles.startupLogo} contentFit="contain" />
      <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      {onRetry ? (
        <View style={{ marginTop: spacing.md }}>
          <Button label="Try Again" variant="secondary" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: spacing.xl, alignItems: "center", justifyContent: "center" },
  startupContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  startupLogo: { width: 140, height: 140 },
  label: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
  errorTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.xs },
  errorMessage: { ...typography.body, color: colors.danger, textAlign: "center", maxWidth: 380 },
});
