import React, { useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { connectGmail } from "../services/gmailService";
import { ApiError } from "../services/api";
import { Button } from "../components/Button";
import { JobJetLogo } from "../components/JobJetLogo";
import { colors, spacing, typography, radius } from "../constants/jobjetTheme";

// Shown right after registration (and on login, if a returning user somehow
// still isn't connected) - JobJet can't send any application emails without
// a connected Gmail account, so this screen sits between auth and the rest
// of the app rather than being buried in Settings. See (main)/_layout.tsx
// for the corresponding gate on every other screen.
export default function ConnectGmailScreen() {
  const router = useRouter();
  const { refreshGmailStatus, logout } = useAuth();

  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setError(null);
    setConnecting(true);
    try {
      const result = await connectGmail();
      if (result.status === "cancelled") {
        setError("Gmail connection was cancelled. You can try again whenever you're ready.");
        return;
      }
      if (result.status === "error") {
        setError("Something went wrong connecting Gmail. Please try again.");
        return;
      }

      // result.status === "success": tokens are already stored server-side
      // by the backend's OAuth callback - just re-check status to update
      // local user state and move on.
      const connected = await refreshGmailStatus();
      if (connected) {
        router.replace("/(main)/emails");
      } else {
        setError("Gmail didn't finish connecting. Please try again.");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start Gmail connection. Please try again.");
    } finally {
      setConnecting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoWrap}>
        <JobJetLogo size={32} />
      </View>

      <View style={styles.iconCircle}>
        <Feather name="mail" size={32} color={colors.primary} />
      </View>

      <Text style={styles.title}>Connect your Gmail</Text>
      <Text style={styles.subtitle}>
        JobJet sends your job applications straight from your own Gmail account, so replies land in your real inbox.
        We only ever ask for permission to send email - never to read it.
      </Text>

      <View style={styles.pointsCard}>
        <Point icon="check-circle" text="Applications are sent from your real Gmail address" />
        <Point icon="lock" text="We never see or store your Gmail password" />
        <Point icon="eye-off" text="JobJet cannot read your inbox - send-only access" />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Button
        label={connecting ? "Connecting..." : "Connect Gmail"}
        onPress={handleConnect}
        loading={connecting}
        style={styles.connectButton}
      />

      {connecting ? (
        <View style={styles.connectingHint}>
          <ActivityIndicator size="small" color={colors.textMuted} />
          <Text style={styles.connectingHintText}>Finish this in the browser that just opened...</Text>
        </View>
      ) : null}

      <Text style={styles.logoutLink} onPress={handleLogout}>
        Log out
      </Text>
    </View>
  );
}

function Point({ icon, text }: { icon: React.ComponentProps<typeof Feather>["name"]; text: string }) {
  return (
    <View style={styles.point}>
      <Feather name={icon} size={16} color={colors.primary} style={styles.pointIcon} />
      <Text style={styles.pointText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    alignItems: "center",
    maxWidth: 460,
    width: "100%",
    alignSelf: "center",
  },
  logoWrap: { marginBottom: spacing.xl },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceTintBlue,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  title: { ...typography.h1, color: colors.textPrimary, textAlign: "center" },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  pointsCard: {
    width: "100%",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  point: { flexDirection: "row", alignItems: "flex-start" },
  pointIcon: { marginTop: 2, marginRight: spacing.sm },
  pointText: { ...typography.body, color: colors.textPrimary, flex: 1 },
  errorText: { ...typography.small, color: colors.danger, textAlign: "center", marginBottom: spacing.md },
  connectButton: { width: "100%" },
  connectingHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  connectingHintText: { ...typography.small, color: colors.textMuted },
  logoutLink: { ...typography.small, color: colors.textSecondary, marginTop: spacing.xxl, textDecorationLine: "underline" },
});
