import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, typography, radius } from "../constants/jobjetTheme";

const PAGE_TITLES: Record<string, string> = {
  "/emails": "Inbox",
  "/dashboard": "Home",
  "/find-companies": "Find Companies",
  "/applications": "Applications",
  "/profile": "Profile",
  "/settings": "Settings",
};

function getTitle(pathname: string) {
  const clean = pathname.replace("/(main)", "");
  const match = Object.keys(PAGE_TITLES).find((key) => clean.startsWith(key));
  return match ? PAGE_TITLES[match] : "JobJet";
}

export function TopBar() {
  const router = useRouter();
  const pathname = usePathname() || "";
  const { user } = useAuth();
  const title = getTitle(pathname);
  const isProfilePage = pathname.replace("/(main)", "").startsWith("/profile");
  const initial = (user?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <View style={styles.bar}>
      <Text style={styles.title}>{title}</Text>
      <Pressable
        onPress={() => router.push("/(main)/profile" as any)}
        style={[styles.avatar, isProfilePage && styles.avatarActive]}
        hitSlop={8}
      >
        <Feather name="user" size={18} color={isProfilePage ? colors.white : colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  title: { ...typography.h2, color: colors.textPrimary },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarActive: { backgroundColor: colors.primary, borderColor: colors.primary },
});
