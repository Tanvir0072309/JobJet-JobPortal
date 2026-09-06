import React, { useState } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import * as authService from "../services/authService";
import { ApiError } from "../services/api";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { JobJetLogo } from "../components/JobJetLogo";
import { colors, spacing, typography } from "../constants/jobjetTheme";

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [step, setStep] = useState<"request" | "reset" | "done">("request");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRequest = async () => {
    setError(null);
    setMessage(null);
    if (!email) {
      setError("Please enter your email.");
      return;
    }
    setLoading(true);
    try {
      const res = await authService.forgotPassword(email.trim());
      setMessage(res.message);
      // No email-sending is wired up yet in this foundation build, so in
      // development the backend returns the raw token directly for testing.
      if (res.devResetToken) setToken(res.devResetToken);
      setStep("reset");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setError(null);
    if (!token || !newPassword) {
      setError("Please enter your reset token and a new password.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      await authService.resetPassword(token.trim(), newPassword);
      setStep("done");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrap}>
          <JobJetLogo size={32} />
        </View>

        <Text style={styles.title}>Reset your password</Text>

        {step === "request" && (
          <View style={styles.form}>
            <Text style={styles.subtitle}>
              Enter your account email. We'll generate a reset link for it.
            </Text>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Button label="Send Reset Link" onPress={handleRequest} loading={loading} />
          </View>
        )}

        {step === "reset" && (
          <View style={styles.form}>
            {message ? <Text style={styles.infoText}>{message}</Text> : null}
            <Text style={styles.subtitle}>
              Note: outbound email delivery isn't wired up yet in this build, so paste the
              reset token from the backend response/logs below.
            </Text>
            <Input label="Reset Token" value={token} onChangeText={setToken} placeholder="Paste reset token" />
            <Input
              label="New Password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="At least 8 characters"
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Button label="Reset Password" onPress={handleReset} loading={loading} />
          </View>
        )}

        {step === "done" && (
          <View style={styles.form}>
            <Text style={styles.infoText}>Your password has been updated.</Text>
            <Button label="Back to Login" onPress={() => router.replace("/login")} />
          </View>
        )}

        <Text style={styles.linkText} onPress={() => router.replace("/login")}>
          Back to login
        </Text>
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
  title: { ...typography.h1, color: colors.textPrimary, textAlign: "center", marginBottom: spacing.md },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  form: { width: "100%" },
  errorText: { ...typography.small, color: colors.danger, marginBottom: spacing.sm },
  infoText: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.sm },
  linkText: { ...typography.small, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
});
