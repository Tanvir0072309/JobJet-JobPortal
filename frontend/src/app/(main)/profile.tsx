import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Modal } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { Feather } from "@expo/vector-icons";
import { Card } from "../../components/Card";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import { LoadingState, ErrorState } from "../../components/LoadingState";
import { EmptyState } from "../../components/EmptyState";
import { TagListInput, arrayToText, textToArray } from "../../components/TagListInput";
import { useAuth } from "../../context/AuthContext";
import * as profileService from "../../services/profileService";
import { ApiError } from "../../services/api";
import { colors, spacing, typography, radius } from "../../constants/jobjetTheme";

const DOCUMENT_TYPES = ["resume", "project_list", "cover_letter", "portfolio", "certificate", "other"];

type Section = "personal" | "professional" | "documents" | null;

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<any>({});
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [openSection, setOpenSection] = useState<Section>(null);

  const load = useCallback(async () => {
    try {
      const [profileRes, docsRes] = await Promise.all([
        profileService.getProfile(),
        profileService.listDocuments(),
      ]);
      setProfile(profileRes.profile || {});
      setDocuments(docsRes.documents);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const setField = (field: string, value: any) => setProfile((prev: any) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        full_name: profile.full_name,
        phone: profile.phone,
        current_location: profile.current_location,
        country: profile.country,
        linkedin_url: profile.linkedin_url,
        github_url: profile.github_url,
        portfolio_url: profile.portfolio_url,
        headline: profile.headline,
        about_me: profile.about_me,
        skills: textToArray(profile._skillsText ?? arrayToText(profile.skills)),
        programming_languages: textToArray(
          profile._langsText ?? arrayToText(profile.programming_languages)
        ),
        frameworks: textToArray(profile._frameworksText ?? arrayToText(profile.frameworks)),
        databases: textToArray(profile._databasesText ?? arrayToText(profile.databases)),
        tools: textToArray(profile._toolsText ?? arrayToText(profile.tools)),
      };
      const res = await profileService.updateProfile(payload);
      setProfile((prev: any) => ({ ...prev, ...res.profile }));
      setOpenSection(null);
    } catch (err) {
      Alert.alert("Couldn't save", err instanceof ApiError ? err.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (documentType: string) => {
    const result = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setUploading(true);
    try {
      await profileService.uploadDocument(
        { uri: asset.uri, name: asset.name, mimeType: asset.mimeType },
        documentType
      );
      await load();
    } catch (err) {
      Alert.alert("Upload failed", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      await profileService.deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      Alert.alert("Couldn't delete document", err instanceof Error ? err.message : "Please try again.");
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await profileService.setDefaultDocument(id);
      await load();
    } catch (err) {
      Alert.alert("Couldn't update document", err instanceof Error ? err.message : "Please try again.");
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const initial = (profile.full_name || user?.email || "?").trim().charAt(0).toUpperCase();
  const defaultResume = useMemo(
    () => documents.find((d) => d.document_type === "resume" && d.is_default),
    [documents]
  );

  if (loading) return <LoadingState label="Loading your profile..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Greeting card */}
      <Card style={styles.heroCard}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarLargeText}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroGreeting}>Hello, {profile.full_name || "there"}</Text>
          <Text style={styles.heroEmail}>{user?.email}</Text>
        </View>
      </Card>

      {/* Quick status row */}
      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <Text style={styles.statNumber}>{documents.length}</Text>
          <Text style={styles.statLabel}>Documents</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statNumber}>{defaultResume ? "Yes" : "No"}</Text>
          <Text style={styles.statLabel}>Resume set</Text>
        </View>
      </View>

      {/* Section: Documents */}
      <Text style={styles.sectionTitle}>Documents</Text>
      <Card style={styles.listCard}>
        <ListRow
          icon="file-text"
          title="Resume & Documents"
          subtitle={defaultResume ? `Default: ${defaultResume.name}` : "Add a resume so it's attached automatically"}
          onPress={() => setOpenSection(openSection === "documents" ? null : "documents")}
          expanded={openSection === "documents"}
        />
        {openSection === "documents" && (
          <View style={styles.expandedArea}>
            <View style={styles.uploadRow}>
              {DOCUMENT_TYPES.map((type) => (
                <Pressable key={type} onPress={() => handleUpload(type)} disabled={uploading} style={styles.uploadPill}>
                  <Feather name="upload" size={12} color={colors.textPrimary} />
                  <Text style={styles.uploadPillText}>{type.replace("_", " ")}</Text>
                </Pressable>
              ))}
            </View>

            {documents.length === 0 ? (
              <EmptyState
                title="No documents uploaded"
                description="Upload your resume and other application documents above. Whatever is marked Default gets attached automatically when you apply."
              />
            ) : (
              documents.map((doc) => (
                <View key={doc.id} style={styles.docRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docName}>{doc.name}</Text>
                    <Text style={styles.docMeta}>
                      {doc.document_type} · {(doc.file_size_bytes / 1024).toFixed(0)} KB
                      {doc.is_default ? " · Default" : ""}
                    </Text>
                  </View>
                  <Pressable onPress={() => handleSetDefault(doc.id)} style={styles.docAction}>
                    <Text style={styles.docActionText}>{doc.is_default ? "Default" : "Set Default"}</Text>
                  </Pressable>
                  <Pressable onPress={() => handleDeleteDocument(doc.id)} style={styles.docAction}>
                    <Feather name="trash-2" size={16} color={colors.danger} />
                  </Pressable>
                </View>
              ))
            )}
          </View>
        )}
      </Card>

      {/* Section: Personal information */}
      <Text style={styles.sectionTitle}>Personal Information</Text>
      <Card style={styles.listCard}>
        <ListRow
          icon="user"
          title="Personal Information"
          subtitle="Name, phone, location, links"
          onPress={() => setOpenSection(openSection === "personal" ? null : "personal")}
          expanded={openSection === "personal"}
        />
        {openSection === "personal" && (
          <View style={styles.expandedArea}>
            <Input label="Full Name" value={profile.full_name || ""} onChangeText={(v) => setField("full_name", v)} />
            <Input label="Phone" value={profile.phone || ""} onChangeText={(v) => setField("phone", v)} />
            <Input
              label="Current Location"
              value={profile.current_location || ""}
              onChangeText={(v) => setField("current_location", v)}
            />
            <Input label="Country" value={profile.country || ""} onChangeText={(v) => setField("country", v)} />
            <Input
              label="LinkedIn"
              value={profile.linkedin_url || ""}
              onChangeText={(v) => setField("linkedin_url", v)}
              autoCapitalize="none"
            />
            <Input
              label="GitHub"
              value={profile.github_url || ""}
              onChangeText={(v) => setField("github_url", v)}
              autoCapitalize="none"
            />
            <Input
              label="Portfolio"
              value={profile.portfolio_url || ""}
              onChangeText={(v) => setField("portfolio_url", v)}
              autoCapitalize="none"
            />
            <Button label="Save" onPress={handleSave} loading={saving} style={{ marginTop: spacing.sm }} />
          </View>
        )}

        <View style={styles.rowDivider} />

        <ListRow
          icon="briefcase"
          title="Professional Information"
          subtitle="Headline, skills, tech stack"
          onPress={() => setOpenSection(openSection === "professional" ? null : "professional")}
          expanded={openSection === "professional"}
        />
        {openSection === "professional" && (
          <View style={styles.expandedArea}>
            <Input label="Headline" value={profile.headline || ""} onChangeText={(v) => setField("headline", v)} />
            <Input
              label="About Me"
              value={profile.about_me || ""}
              onChangeText={(v) => setField("about_me", v)}
              multiline
              numberOfLines={4}
              style={{ minHeight: 90, textAlignVertical: "top" }}
            />
            <TagListInput
              label="Skills"
              value={profile._skillsText ?? arrayToText(profile.skills)}
              onChangeText={(v) => setField("_skillsText", v)}
            />
            <TagListInput
              label="Programming Languages"
              value={profile._langsText ?? arrayToText(profile.programming_languages)}
              onChangeText={(v) => setField("_langsText", v)}
            />
            <TagListInput
              label="Frameworks"
              value={profile._frameworksText ?? arrayToText(profile.frameworks)}
              onChangeText={(v) => setField("_frameworksText", v)}
            />
            <TagListInput
              label="Databases"
              value={profile._databasesText ?? arrayToText(profile.databases)}
              onChangeText={(v) => setField("_databasesText", v)}
            />
            <TagListInput
              label="Tools"
              value={profile._toolsText ?? arrayToText(profile.tools)}
              onChangeText={(v) => setField("_toolsText", v)}
            />
            <Button label="Save" onPress={handleSave} loading={saving} style={{ marginTop: spacing.sm }} />
          </View>
        )}
      </Card>

      {/* Section: General */}
      <Text style={styles.sectionTitle}>General</Text>
      <Card style={styles.listCard}>
        <ListRow icon="settings" title="Settings" subtitle="API keys, sending email, preferences" onPress={() => router.push("/(main)/settings" as any)} />
        <View style={styles.rowDivider} />
        <ListRow icon="log-out" title="Logout" subtitle="" danger onPress={handleLogout} />
      </Card>
    </ScrollView>
  );
}

function ListRow({
  icon,
  title,
  subtitle,
  onPress,
  expanded,
  danger,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  expanded?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={styles.listRow}>
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Feather name={icon} size={16} color={danger ? colors.danger : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, danger && { color: colors.danger }]}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {!danger ? (
        <Feather name={expanded ? "chevron-up" : "chevron-right"} size={18} color={colors.textMuted} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md, maxWidth: 720, width: "100%", alignSelf: "center" },

  heroCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLargeText: { ...typography.h2, color: colors.white },
  heroGreeting: { ...typography.h3, color: colors.textPrimary },
  heroEmail: { ...typography.small, color: colors.textMuted, marginTop: 2 },

  statsRow: { flexDirection: "row", gap: spacing.sm },
  statPill: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  statNumber: { ...typography.h3, color: colors.textPrimary },
  statLabel: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },

  sectionTitle: { ...typography.small, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginTop: spacing.sm },
  listCard: { gap: 0, padding: 0, overflow: "hidden" },

  listRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.infoBg,
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconDanger: { backgroundColor: colors.dangerBg },
  rowTitle: { ...typography.bodyBold, color: colors.textPrimary },
  rowSubtitle: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  rowDivider: { height: 1, backgroundColor: colors.border, marginLeft: spacing.md },

  expandedArea: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.xs },

  uploadRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm },
  uploadPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  uploadPillText: { ...typography.small, color: colors.textPrimary, textTransform: "capitalize" },

  docRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  docName: { ...typography.bodyBold, color: colors.textPrimary },
  docMeta: { ...typography.small, color: colors.textMuted },
  docAction: { paddingHorizontal: spacing.xs },
  docActionText: { ...typography.small, color: colors.textPrimary, fontWeight: "600" },
});
