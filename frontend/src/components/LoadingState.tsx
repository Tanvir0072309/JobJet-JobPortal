import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Button } from "./Button";
import { colors, spacing, typography } from "../constants/jobjetTheme";

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
  label: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
  errorTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.xs },
  errorMessage: { ...typography.body, color: colors.danger, textAlign: "center", maxWidth: 380 },
});
