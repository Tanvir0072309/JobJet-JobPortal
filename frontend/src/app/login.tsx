import React, { useState } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../services/api";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { JobJetLogo } from "../components/JobJetLogo";
import { colors, spacing, typography } from "../constants/jobjetTheme";

export default function LoginScreen() {
  const router = useRouter();
  const { login, refreshGmailStatus } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      // Existing accounts from before Gmail OAuth existed (or anyone who
      // disconnected Gmail from Settings) still need to connect it -
      // check explicitly here instead of trusting the (main) layout's
      // gate to catch up before this screen has already navigated away.
      const connected = await refreshGmailStatus();
      router.replace(connected ? "/(main)/applications" : "/connect-gmail");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrap}>
          <JobJetLogo size={32} />
        </View>

        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Log in to manage your job applications.</Text>

        <View style={styles.form}>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Button label="Log In" onPress={handleSubmit} loading={loading} style={styles.submitButton} />

          <Text style={styles.linkText} onPress={() => router.push("/forgot-password")}>
            Forgot password?
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Text style={[styles.footerText, styles.footerLink]} onPress={() => router.push("/register")}>
            Create one
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.white },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
    maxWidth: 420,
    width: "100%",
    alignSelf: "center",
  },
  logoWrap: { alignItems: "center", marginBottom: spacing.xl },
  title: { ...typography.h1, color: colors.textPrimary, textAlign: "center" },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  form: { width: "100%" },
  submitButton: { marginTop: spacing.sm },
  errorText: { ...typography.small, color: colors.danger, marginBottom: spacing.sm },
  linkText: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.md,
  },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.xl },
  footerText: { ...typography.body, color: colors.textSecondary },
  footerLink: { color: colors.textPrimary, fontWeight: "700" },
});
