import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Card } from "../../components/Card";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import { LoadingState, ErrorState } from "../../components/LoadingState";
import { useAuth } from "../../context/AuthContext";
import * as settingsService from "../../services/settingsService";
import { connectGmail, disconnectGmail } from "../../services/gmailService";
import { ApiError } from "../../services/api";
import { getCached, setCached } from "../../utils/screenCache";
import { colors, spacing, typography, radius } from "../../constants/jobjetTheme";

const WORK_MODES = ["remote", "hybrid", "onsite", "any"] as const;
const TONES = ["professional", "friendly", "concise", "enthusiastic"] as const;

const CACHE_KEY = "settings:data";
type CachedSettings = { credentials: Record<string, any>; appSettings: any };

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout, refreshGmailStatus } = useAuth();
  const cached = getCached<CachedSettings>(CACHE_KEY);

  const [loading, setLoading] = useState(cached === undefined);
  const [error, setError] = useState<string | null>(null);

  const [credentials, setCredentials] = useState<Record<string, any>>(cached?.credentials ?? {});
  const [groqKey, setGroqKey] = useState("");
  const [hunterKey, setHunterKey] = useState("");
  const [savingProvider, setSavingProvider] = useState<string | null>(null);

  const [gmailBusy, setGmailBusy] = useState(false);
  const [gmailError, setGmailError] = useState<string | null>(null);

  const [appSettings, setAppSettings] = useState<any>(cached?.appSettings ?? {});
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  // This screen fully remounts every time you switch away from and back to
  // the Settings tab (see screenCache.ts) - the cache above just lets that
  // remount show last-known data instantly instead of a spinner while this
  // refetch (still run on every focus, as before) completes quietly.
  const load = useCallback(async () => {
    try {
      const [credsRes, settingsRes] = await Promise.all([
        settingsService.getApiCredentials(),
        settingsService.getApplicationSettings(),
      ]);
      setCredentials(credsRes.credentials);
      setAppSettings(settingsRes.settings || {});
      setCached(CACHE_KEY, { credentials: credsRes.credentials, appSettings: settingsRes.settings || {} });
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
    const value = provider === "hunter" ? hunterKey : groqKey;
    if (!value.trim()) return;
    setSavingProvider(provider);
    try {
      await settingsService.saveApiCredential(provider, value.trim());
      if (provider === "hunter") setHunterKey("");
      else setGroqKey("");
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

  const handleConnectGmail = async () => {
    setGmailError(null);
    setGmailBusy(true);
    try {
      const result = await connectGmail();
      if (result.status === "cancelled") {
        setGmailError("Connection cancelled.");
        return;
      }
      if (result.status === "error") {
        setGmailError("Something went wrong connecting Gmail. Please try again.");
        return;
      }
      const connected = await refreshGmailStatus();
      if (!connected) setGmailError("Gmail didn't finish connecting. Please try again.");
    } catch (err) {
      setGmailError(err instanceof ApiError ? err.message : "Couldn't start Gmail connection. Please try again.");
    } finally {
      setGmailBusy(false);
    }
  };

  const handleDisconnectGmail = async () => {
    Alert.alert(
      "Disconnect Gmail?",
      "JobJet won't be able to send application emails until you reconnect.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            setGmailBusy(true);
            setGmailError(null);
            try {
              await disconnectGmail();
              await refreshGmailStatus();
            } catch (err) {
              setGmailError(err instanceof ApiError ? err.message : "Couldn't disconnect. Please try again.");
            } finally {
              setGmailBusy(false);
            }
          },
        },
      ]
    );
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
          label="Hunter API Key (optional)"
          status={credentials.hunter}
          value={hunterKey}
          onChangeText={setHunterKey}
          onSave={() => handleSaveKey("hunter")}
          onRemove={() => handleRemoveKey("hunter")}
          saving={savingProvider === "hunter"}
        />
        <Text style={styles.helperNote}>
          Optional - improves accuracy with verified emails. Without a Hunter key, JobJet automatically uses its own
          built-in email finder, reading each company's own website (contact/careers/about pages) to find an email
          instead - so applying always works even with no key configured. Get a free Hunter key at hunter.io if you
          want it (50 credits/month, no card) - some accounts need a work email to sign up, so this is purely
          optional.
        </Text>
      </Card>

      <Text style={styles.sectionTitle}>Sending Email</Text>
      <Card style={styles.card}>
        <Text style={styles.rowLabel}>Gmail connection</Text>
        {user?.gmailConnected ? (
          <Text style={styles.rowValue}>Connected ({user.gmailEmail})</Text>
        ) : (
          <Text style={styles.rowValueMuted}>Not connected - applications can't be sent yet</Text>
        )}

        {gmailError ? <Text style={styles.errorText}>{gmailError}</Text> : null}

        <View style={styles.credentialActions}>
          {user?.gmailConnected ? (
            <>
              <Button label="Reconnect" variant="secondary" onPress={handleConnectGmail} loading={gmailBusy} style={{ flex: 1 }} />
              <Button label="Disconnect" variant="danger" onPress={handleDisconnectGmail} loading={gmailBusy} style={{ flex: 1 }} />
            </>
          ) : (
            <Button label="Connect Gmail" onPress={handleConnectGmail} loading={gmailBusy} style={{ flex: 1 }} />
          )}
        </View>

        <Text style={styles.helperNote}>
          JobJet sends applications through your Gmail account via Google's official API - no password or app
          password needed. This connection only allows sending email; JobJet cannot read your inbox.
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
  errorText: { ...typography.small, color: colors.danger, marginBottom: spacing.xs },
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
