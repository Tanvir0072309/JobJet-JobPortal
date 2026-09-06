import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, useWindowDimensions, Modal } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { JobJetLogo } from "./JobJetLogo";
import { useAuth } from "../context/AuthContext";
import { colors, spacing, typography } from "../constants/jobjetTheme";

const NAV_ITEMS = [
  { label: "Applications", href: "/(main)/applications" },
  { label: "Find Companies", href: "/(main)/find-companies" },
  { label: "Dashboard", href: "/(main)/dashboard" },
  { label: "Profile", href: "/(main)/profile" },
  { label: "Settings", href: "/(main)/settings" },
] as const;

const NARROW_BREAKPOINT = 760;

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const { width } = useWindowDimensions();
  const [menuOpen, setMenuOpen] = useState(false);
  const isNarrow = width < NARROW_BREAKPOINT;

  const isActive = (href: string) => pathname?.startsWith(href.replace("(main)/", ""));

  const navigate = (href: string) => {
    setMenuOpen(false);
    router.push(href as any);
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    router.replace("/login");
  };

  return (
    <View style={styles.header}>
      <Pressable onPress={() => navigate("/(main)/applications")} style={styles.logoArea}>
        <JobJetLogo size={22} />
      </Pressable>

      {!isNarrow ? (
        <>
          <View style={styles.navRow}>
            {NAV_ITEMS.map((item) => (
              <Pressable key={item.href} onPress={() => navigate(item.href)} style={styles.navItem}>
                <Text style={[styles.navLabel, isActive(item.href) && styles.navLabelActive]}>
                  {item.label}
                </Text>
                {isActive(item.href) && <View style={styles.activeUnderline} />}
              </Pressable>
            ))}
          </View>
          <View style={styles.rightArea}>
            <Text style={styles.emailText} numberOfLines={1}>
              {user?.email}
            </Text>
            <Pressable onPress={handleLogout} style={styles.logoutButton}>
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Pressable onPress={() => setMenuOpen(true)} style={styles.hamburger} hitSlop={10}>
          <View style={styles.hamburgerLine} />
          <View style={styles.hamburgerLine} />
          <View style={styles.hamburgerLine} />
        </Pressable>
      )}

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setMenuOpen(false)}>
          <View style={styles.menuSheet}>
            {NAV_ITEMS.map((item) => (
              <Pressable key={item.href} onPress={() => navigate(item.href)} style={styles.menuItem}>
                <Text style={[styles.menuItemText, isActive(item.href) && styles.navLabelActive]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
            <View style={styles.menuDivider} />
            <Text style={styles.menuEmail}>{user?.email}</Text>
            <Pressable onPress={handleLogout} style={styles.menuItem}>
              <Text style={[styles.menuItemText, { color: colors.danger }]}>Logout</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  logoArea: { flexDirection: "row", alignItems: "center" },
  navRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg, flex: 1, justifyContent: "center" },
  navItem: { paddingVertical: spacing.xs, alignItems: "center" },
  navLabel: { ...typography.body, color: colors.textSecondary },
  navLabelActive: { color: colors.textPrimary, fontWeight: "700" },
  activeUnderline: { height: 2, width: "100%", backgroundColor: colors.primary, marginTop: 4, borderRadius: 1 },
  rightArea: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  emailText: { ...typography.small, color: colors.textMuted, maxWidth: 160 },
  logoutButton: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  logoutText: { ...typography.small, color: colors.textPrimary, fontWeight: "600" },
  hamburger: { gap: 4, padding: spacing.xs },
  hamburgerLine: { width: 20, height: 2, backgroundColor: colors.primary, borderRadius: 1 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-start", alignItems: "flex-end" },
  menuSheet: {
    marginTop: 60,
    marginRight: spacing.md,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    minWidth: 200,
  },
  menuItem: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  menuItemText: { ...typography.body, color: colors.textPrimary },
  menuDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  menuEmail: { ...typography.small, color: colors.textMuted, paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
});
