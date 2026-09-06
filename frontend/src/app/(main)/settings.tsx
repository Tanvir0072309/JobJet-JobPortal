import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Card } from "../../components/Card";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import { LoadingState, ErrorState } from "../../components/LoadingState";
import { useAuth } from "../../context/AuthContext";
import * as settingsService from "../../services/settingsService";
import { ApiError } from "../../services/api";
import { colors, spacing, typography, radius } from "../../constants/jobjetTheme";

const WORK_MODES = ["remote", "hybrid", "onsite", "any"] as const;
const TONES = ["professional", "friendly", "concise", "enthusiastic"] as const;

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [credentials, setCredentials] = useState<Record<string, any>>({});
  const [groqKey, setGroqKey] = useState("");
  const [hunterKey, setHunterKey] = useState("");
  const [savingProvider, setSavingProvider] = useState<string | null>(null);

  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFromName, setSmtpFromName] = useState("");
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("");
  const [savingSmtp, setSavingSmtp] = useState(false);

  const [appSettings, setAppSettings] = useState<any>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [credsRes, settingsRes] = await Promise.all([
        settingsService.getApiCredentials(),
        settingsService.getApplicationSettings(),
      ]);
      setCredentials(credsRes.credentials);
      setAppSettings(settingsRes.settings || {});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleSaveKey = async (provider: "groq" | "hunter") => {
    const value = provider === "groq" ? groqKey : hunterKey;
    if (!value.trim()) return;
    setSavingProvider(provider);
    try {
      await settingsService.saveApiCredential(provider, value.trim());
      if (provider === "groq") setGroqKey("");
      else setHunterKey("");
      await load();
    } catch (err) {
      Alert.alert("Couldn't save key", err instanceof ApiError ? err.message : "Please try again.");
    } finally {
      setSavingProvider(null);
    }
  };

  const handleRemoveKey = async (provider: "groq" | "hunter") => {
    setSavingProvider(provider);
    try {
      await settingsService.deleteApiCredential(provider);
      await load();
    } catch (err) {
      Alert.alert("Couldn't remove key", err instanceof ApiError ? err.message : "Please try again.");
    } finally {
      setSavingProvider(null);
    }
  };

  const handleSaveSmtp = async () => {
    if (!smtpHost.trim() || !smtpUser.trim() || !smtpPass.trim()) {
      Alert.alert("Missing details", "Host, email, and app password are all required.");
      return;
    }
    setSavingSmtp(true);
    try {
      await settingsService.saveSmtpCredential({
        host: smtpHost.trim(),
        port: Number(smtpPort) || 587,
        user: smtpUser.trim(),
        pass: smtpPass,
        fromName: smtpFromName.trim(),
        imapHost: imapHost.trim() || undefined,
        imapPort: imapPort ? Number(imapPort) : undefined,
      });
      setSmtpPass("");
      await load();
    } catch (err) {
      Alert.alert("Couldn't save sending email", err instanceof ApiError ? err.message : "Please try again.");
    } finally {
      setSavingSmtp(false);
    }
  };

  const handleRemoveSmtp = async () => {
    setSavingSmtp(true);
    try {
      await settingsService.deleteApiCredential("smtp");
      await load();
    } catch (err) {
      Alert.alert("Couldn't remove", err instanceof ApiError ? err.message : "Please try again.");
    } finally {
      setSavingSmtp(false);
    }
  };

  const handleSaveAppSettings = async () => {
    setSavingSettings(true);
    setSettingsMessage(null);
    try {
      const res = await settingsService.updateApplicationSettings({
        default_company_search_limit: Number(appSettings.default_company_search_limit) || 20,
        default_location: appSettings.default_location,
        remote_preference: appSettings.remote_preference,
        email_signature: appSettings.email_signature,
        application_tone: appSettings.application_tone,
      });
      setAppSettings(res.settings);
      setSettingsMessage("Settings saved.");
    } catch (err) {
      setSettingsMessage(err instanceof ApiError ? err.message : "Couldn't save settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  if (loading) return <LoadingState label="Loading settings..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.sectionTitle}>Account</Text>
      <Card style={styles.card}>
        <Text style={styles.rowLabel}>Email</Text>
        <Text style={styles.rowValue}>{user?.email}</Text>
        <Button label="Logout" variant="secondary" onPress={handleLogout} style={{ marginTop: spacing.md }} />
      </Card>

      <Text style={styles.sectionTitle}>API & Integrations</Text>
      <Card style={styles.card}>
        <CredentialRow
          label="Groq API Key"
          status={credentials.groq}
          value={groqKey}
          onChangeText={setGroqKey}
          onSave={() => handleSaveKey("groq")}
          onRemove={() => handleRemoveKey("groq")}
          saving={savingProvider === "groq"}
        />
        <View style={styles.divider} />
        <CredentialRow
          label="Hunter API Key"
          status={credentials.hunter}
          value={hunterKey}
          onChangeText={setHunterKey}
          onSave={() => handleSaveKey("hunter")}
          onRemove={() => handleRemoveKey("hunter")}
          saving={savingProvider === "hunter"}
        />
      </Card>

      <Text style={styles.sectionTitle}>Sending Email</Text>
      <Card style={styles.card}>
        <Text style={styles.rowLabel}>Status</Text>
        {credentials.smtp?.configured ? (
          <Text style={styles.rowValue}>Connected ({credentials.smtp.maskedKey})</Text>
        ) : (
          <Text style={styles.rowValueMuted}>Not connected - applications can't be sent yet</Text>
        )}
        <Input label="SMTP host" value={smtpHost} onChangeText={setSmtpHost} placeholder="smtp.gmail.com" autoCapitalize="none" />
        <Input label="Port" value={smtpPort} onChangeText={(v) => setSmtpPort(v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" placeholder="587" />
        <Input label="Email address" value={smtpUser} onChangeText={setSmtpUser} placeholder="you@gmail.com" autoCapitalize="none" />
        <Input label="App password" value={smtpPass} onChangeText={setSmtpPass} secureTextEntry placeholder="16-character app password" />
        <Input label="Display name (optional)" value={smtpFromName} onChangeText={setSmtpFromName} placeholder="Your Name" />
        <Input
          label="IMAP host (optional)"
          value={imapHost}
          onChangeText={setImapHost}
          placeholder="Auto-detected for Gmail/Outlook/Yahoo/iCloud/Zoho"
          autoCapitalize="none"
        />
        <Input
          label="IMAP port (optional)"
          value={imapPort}
          onChangeText={(v) => setImapPort(v.replace(/[^0-9]/g, ""))}
          keyboardType="number-pad"
          placeholder="993"
        />
        <View style={styles.credentialActions}>
          <Button label="Save" onPress={handleSaveSmtp} loading={savingSmtp} style={{ flex: 1 }} />
          {credentials.smtp?.configured ? (
            <Button label="Remove" variant="danger" onPress={handleRemoveSmtp} style={{ flex: 1 }} />
          ) : null}
        </View>
        <Text style={styles.helperNote}>
          Gmail users: turn on 2-Step Verification, then create an "App Password" - use that here, not your normal
          password. This same account is also used to check for replies (via IMAP) on the Emails tab - only fill in
          "IMAP host" if your provider isn't Gmail, Outlook, Yahoo, iCloud, or Zoho.
        </Text>
      </Card>

      <Text style={styles.sectionTitle}>Application Settings</Text>
      <Card style={styles.card}>
        <Input
          label="Default company search limit"
          value={String(appSettings.default_company_search_limit ?? "")}
          onChangeText={(v) =>
            setAppSettings((prev: any) => ({ ...prev, default_company_search_limit: v.replace(/[^0-9]/g, "") }))
          }
          keyboardType="number-pad"
        />
        <Input
          label="Default location"
          value={appSettings.default_location || ""}
          onChangeText={(v) => setAppSettings((prev: any) => ({ ...prev, default_location: v }))}
        />

        <Text style={styles.rowLabel}>Preferred work mode</Text>
        <View style={styles.pillRow}>
          {WORK_MODES.map((mode) => (
            <Pressable
              key={mode}
              onPress={() => setAppSettings((prev: any) => ({ ...prev, remote_preference: mode }))}
              style={[styles.pill, appSettings.remote_preference === mode && styles.pillActive]}
            >
              <Text style={[styles.pillText, appSettings.remote_preference === mode && styles.pillTextActive]}>
                {mode}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.rowLabel}>AI application tone</Text>
        <View style={styles.pillRow}>
          {TONES.map((tone) => (
            <Pressable
              key={tone}
              onPress={() => setAppSettings((prev: any) => ({ ...prev, application_tone: tone }))}
              style={[styles.pill, appSettings.application_tone === tone && styles.pillActive]}
            >
              <Text style={[styles.pillText, appSettings.application_tone === tone && styles.pillTextActive]}>
                {tone}
              </Text>
            </Pressable>
          ))}
        </View>

        <Input
          label="Email signature"
          value={appSettings.email_signature || ""}
          onChangeText={(v) => setAppSettings((prev: any) => ({ ...prev, email_signature: v }))}
          multiline
          numberOfLines={3}
          style={{ minHeight: 70, textAlignVertical: "top" }}
        />

        {settingsMessage ? <Text style={styles.saveMessage}>{settingsMessage}</Text> : null}
        <Button label="Save Settings" onPress={handleSaveAppSettings} loading={savingSettings} />
      </Card>
    </ScrollView>
  );
}

function CredentialRow({
  label,
  status,
  value,
  onChangeText,
  onSave,
  onRemove,
  saving,
}: {
  label: string;
  status: any;
  value: string;
  onChangeText: (v: string) => void;
  onSave: () => void;
  onRemove: () => void;
  saving: boolean;
}) {
  return (
    <View>
      <Text style={styles.rowLabel}>{label}</Text>
      {status?.configured ? (
        <Text style={styles.rowValue}>Configured ({status.maskedKey})</Text>
      ) : (
        <Text style={styles.rowValueMuted}>Not configured</Text>
      )}
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder={status?.configured ? "Enter a new key to replace it" : "Paste your API key"}
        secureTextEntry
        autoCapitalize="none"
      />
      <View style={styles.credentialActions}>
        <Button label="Save" onPress={onSave} loading={saving} style={{ flex: 1 }} />
        {status?.configured ? (
          <Button label="Remove" variant="danger" onPress={onRemove} style={{ flex: 1 }} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.sm, maxWidth: 720, width: "100%", alignSelf: "center" },
  sectionTitle: { ...typography.h2, color: colors.textPrimary, marginTop: spacing.md },
  card: { gap: 0 },
  rowLabel: { ...typography.small, color: colors.textSecondary, marginTop: spacing.sm },
  rowValue: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.xs },
  rowValueMuted: { ...typography.body, color: colors.textMuted, marginBottom: spacing.xs, fontStyle: "italic" },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  helperNote: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm, fontStyle: "italic" },
  credentialActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { ...typography.small, color: colors.textPrimary, textTransform: "capitalize" },
  pillTextActive: { color: colors.white, fontWeight: "700" },
  saveMessage: { ...typography.small, color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.xs },
});
