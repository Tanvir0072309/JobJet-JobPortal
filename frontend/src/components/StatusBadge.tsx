import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { statusMeta, colors, radius, spacing, typography } from "../constants/jobjetTheme";

export function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta[status] || {
    fg: colors.textSecondary,
    bg: colors.surfaceMuted,
    label: status,
  };

  return (
    <View style={[styles.badge, { backgroundColor: meta.bg }]}>
      <Text style={[styles.text, { color: meta.fg }]}>{meta.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    alignSelf: "flex-start",
  },
  text: { ...typography.tiny, textTransform: "uppercase" },
});
