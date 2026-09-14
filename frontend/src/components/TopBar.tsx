import React from "react";
import { View, Text, Pressable, StyleSheet, Image } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { resolveAvatarUrl } from "../services/profileService";
import { colors, spacing, typography, radius } from "../constants/jobjetTheme";

const PAGE_TITLES: Record<string, string> = {
  "/emails": "Inbox",
  "/dashboard": "Home",
  "/find-companies": "Find Companies",
  "/send-email": "Send Email",
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
  const insets = useSafeAreaInsets();
  const title = getTitle(pathname);
  const isProfilePage = pathname.replace("/(main)", "").startsWith("/profile");
  // Show the candidate's own uploaded photo when there is one - the plain
  // "user" icon is only the fallback for when no image has been uploaded.
  const avatarSource = resolveAvatarUrl(user?.avatarUrl);

  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.md }]}>
      <Text style={styles.title}>{title}</Text>
      <Pressable
        onPress={() => router.push("/(main)/profile" as any)}
        style={[styles.avatar, isProfilePage && styles.avatarActive]}
        hitSlop={8}
      >
        {avatarSource ? (
          <Image source={{ uri: avatarSource }} style={styles.avatarImage} />
        ) : (
          <Feather name="user" size={18} color={isProfilePage ? colors.white : colors.primary} />
        )}
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
    overflow: "hidden",
  },
  avatarActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  avatarImage: { width: "100%", height: "100%" },
});
