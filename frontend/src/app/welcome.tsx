import React from "react";
import { View, Text, StyleSheet, ScrollView, Image } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../components/Button";
import { JobJetMark } from "../components/JobJetLogo";
import { colors, gradients, spacing, typography, radius } from "../constants/jobjetTheme";

const glowSource = require("../../assets/images/logo-glow.png");

const FEATURES: { icon: keyof typeof Feather.glyphMap; title: string; body: string }[] = [
  {
    icon: "search",
    title: "Find the right roles",
    body: "Browse companies and jobs that match your skills, all in one place.",
  },
  {
    icon: "mail",
    title: "Track every application",
    body: "See replies, interviews, and follow-ups without digging through your inbox.",
  },
  {
    icon: "file-text",
    title: "Keep documents ready",
    body: "Store your resume, cover letters, and portfolio for one-tap applying.",
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.flex}>
      {/* This screen's hero is a dark gradient behind the status bar, so its
          icons need to be light here — overriding the app-wide dark style
          set in the root layout. Restored automatically when this screen
          unmounts. */}
      <StatusBar style="light" />
      <LinearGradient
        colors={["#3B82F6", colors.primary, colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + spacing.xl }]}
      >
        {/* Decorative soft circles for a bit of depth behind the logo. */}
        <View style={[styles.decorCircle, styles.decorCircleLarge]} />
        <View style={[styles.decorCircle, styles.decorCircleSmall]} />

        <Image source={glowSource} style={styles.glow} />
        <View style={styles.logoBadge}>
          <JobJetMark size={56} />
        </View>
        <Text style={styles.heroTitle}>JobJet</Text>
        <Text style={styles.heroSubtitle}>Your job search, organized and on autopilot.</Text>
      </LinearGradient>

      <ScrollView
        style={styles.sheet}
        contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {FEATURES.map((feature) => (
          <View key={feature.title} style={styles.featureRow}>
            <LinearGradient colors={gradients.brand} style={styles.featureIcon}>
              <Feather name={feature.icon} size={18} color={colors.white} />
            </LinearGradient>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureBody}>{feature.body}</Text>
            </View>
          </View>
        ))}

        <View style={styles.actions}>
          <Button label="Get Started" onPress={() => router.push("/register")} />
          <Button
            label="I already have an account"
            variant="secondary"
            onPress={() => router.push("/login")}
            style={styles.secondButton}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.white },
  hero: {
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    overflow: "hidden",
    position: "relative",
  },
  decorCircle: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  decorCircleLarge: { width: 260, height: 260, top: -120, right: -80 },
  decorCircleSmall: { width: 140, height: 140, bottom: -40, left: -50 },
  glow: {
    position: "absolute",
    top: -40,
    width: 220,
    height: 220,
    opacity: 0.55,
  },
  logoBadge: {
    width: 88,
    height: 88,
    borderRadius: radius.lg,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  heroTitle: { ...typography.h1, color: colors.white, fontSize: 34 },
  heroSubtitle: {
    ...typography.body,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    marginTop: spacing.xs,
    maxWidth: 280,
  },
  sheet: { flex: 1, marginTop: -radius.lg },
  sheetContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    flexGrow: 1,
    justifyContent: "space-between",
    maxWidth: 420,
    width: "100%",
    alignSelf: "center",
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: { flex: 1 },
  featureTitle: { ...typography.bodyBold, color: colors.textPrimary },
  featureBody: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  actions: { marginTop: spacing.lg, gap: spacing.sm },
  secondButton: { marginTop: 0 },
});
