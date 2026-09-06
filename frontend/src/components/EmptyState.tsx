import React, { ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, typography } from "../constants/jobjetTheme";

type Props = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
  },
  title: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.xs, textAlign: "center" },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 380,
  },
  action: { marginTop: spacing.md },
});
