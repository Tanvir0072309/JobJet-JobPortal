import React, { ReactNode } from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { spacing } from "../constants/jobjetTheme";

// Plain grouping container — no border, no shadow, no rounded box. Visual
// separation between sections comes from spacing and hairline dividers
// inside each screen, not from wrapping everything in its own box.
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: spacing.sm,
  },
});
