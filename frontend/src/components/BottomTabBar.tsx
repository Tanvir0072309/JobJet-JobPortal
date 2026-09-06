import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, typography } from "../constants/jobjetTheme";

type TabItem = {
  key: string;
  label: string;
  href: string;
  icon: keyof typeof Feather.glyphMap;
};

// Four tabs, one job each — Find Jobs and the old centre "Apply" button
// pointed at the same screen, so they've been merged into one.
const TABS: TabItem[] = [
  { key: "mail", label: "Mail", href: "/(main)/emails", icon: "mail" },
  { key: "find", label: "Find Jobs", href: "/(main)/find-companies", icon: "search" },
  { key: "applications", label: "Applications", href: "/(main)/applications", icon: "briefcase" },
  { key: "settings", label: "Settings", href: "/(main)/settings", icon: "settings" },
];

export function BottomTabBar() {
  const router = useRouter();
  const pathname = usePathname() || "";
  const insets = useSafeAreaInsets();

  const isActive = (href: string) => pathname.startsWith(href.replace("(main)/", "").replace(/^\//, "/"));

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      {TABS.map((tab) => {
        const active = isActive(tab.href);
        return (
          <Pressable key={tab.key} onPress={() => router.push(tab.href as any)} style={styles.item}>
            <Feather name={tab.icon} size={20} color={active ? colors.black : colors.textMuted} />
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    width: "100%",
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  item: { alignItems: "center", justifyContent: "center", gap: 3, flex: 1 },
  label: { ...typography.tiny, color: colors.textMuted },
  labelActive: { color: colors.black, fontWeight: "700" },
});
