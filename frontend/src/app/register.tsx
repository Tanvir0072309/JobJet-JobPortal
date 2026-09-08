import React, { useState } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../services/api";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { JobJetLogo } from "../components/JobJetLogo";
import { colors, spacing, typography } from "../constants/jobjetTheme";

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);

    if (!email || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await register(email.trim(), password);
      router.replace("/(main)/applications");
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

        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Start managing your job search with JobJet.</Text>

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
            placeholder="At least 8 characters"
          />
          <Input
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder="Repeat your password"
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Button label="Create Account" onPress={handleSubmit} loading={loading} style={styles.submitButton} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Text style={[styles.footerText, styles.footerLink]} onPress={() => router.push("/login")}>
            Log in
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
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.xl },
  footerText: { ...typography.body, color: colors.textSecondary },
  footerLink: { color: colors.textPrimary, fontWeight: "700" },
});
