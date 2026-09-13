import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Modal, Image } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { Card } from "../../components/Card";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import { LoadingState, ErrorState } from "../../components/LoadingState";
import { EmptyState } from "../../components/EmptyState";
import { TagListInput, arrayToText, textToArray } from "../../components/TagListInput";
import { useAuth } from "../../context/AuthContext";
import * as profileService from "../../services/profileService";
import { listApplications } from "../../services/applicationsService";
import { ApiError } from "../../services/api";
import { colors, spacing, typography, radius } from "../../constants/jobjetTheme";
import { buildAchievements } from "../../utils/achievements";

const DOCUMENT_TYPES = ["resume", "project_list", "cover_letter", "portfolio", "certificate", "other"];

type Section = "personal" | "professional" | "documents" | "interested" | null;

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<any>({});
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [openSection, setOpenSection] = useState<Section>(null);
  const [achievements, setAchievements] = useState<ReturnType<typeof buildAchievements>["achievements"]>([]);
  const [newPostTitle, setNewPostTitle] = useState("");
  const [uploadingPost, setUploadingPost] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [profileRes, docsRes, appsRes] = await Promise.all([
        profileService.getProfile(),
        profileService.listDocuments(),
        listApplications().catch(() => ({ applications: [] })),
      ]);
      setProfile(profileRes.profile || {});
      setDocuments(docsRes.documents);
      setAchievements(buildAchievements(appsRes.applications || []).achievements);
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
    const result = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
      // Explicit allow-list so PDFs (and Word docs / images) are reliably
      // pickable on every platform — leaving this as the default "*/*" was
      // causing some Android file-picker apps to hide PDFs entirely.
      type: [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "image/png",
        "image/jpeg",
      ],
    });
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

  const handlePickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo library access to set a profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setUploadingAvatar(true);
    try {
      const res = await profileService.uploadAvatar({
        uri: asset.uri,
        name: asset.fileName || "avatar.jpg",
        mimeType: asset.mimeType,
      });
      setProfile((prev: any) => ({ ...prev, avatar_url: res.avatar_url }));
    } catch (err) {
      Alert.alert("Couldn't update photo", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  // --- Interested Posts (job titles the candidate is targeting) ---
  // Each post can have its own resume/project-list attached (via
  // documents.post_tag) - when applying to a job whose title matches a
  // tagged post, that specific pair gets used instead of the default.
  //
  // The backend requires at least 5 posts before it will save the list at
  // all (see profileController.js) - so, unlike every other field on this
  // screen, additions/removals are kept in local draft state and only sent
  // once there are enough of them, with a running "X/5" counter so it's
  // clear why the Save button is disabled until then.
  const savedPosts: string[] = Array.isArray(profile.interested_posts) ? profile.interested_posts : [];
  const MIN_INTERESTED_POSTS = 5;
  const [draftPosts, setDraftPosts] = useState<string[] | null>(null);
  const posts = draftPosts ?? savedPosts;
  const postsDirty = draftPosts !== null;
  const [savingPosts, setSavingPosts] = useState(false);

  const documentForPost = useCallback(
    (post: string) => documents.find((d) => d.post_tag && d.post_tag.toLowerCase() === post.toLowerCase()),
    [documents]
  );

  const handleAddInterestedPost = () => {
    const title = newPostTitle.trim();
    if (!title) return;
    if (posts.some((p) => p.toLowerCase() === title.toLowerCase())) {
      setNewPostTitle("");
      return;
    }
    setNewPostTitle("");
    setDraftPosts([...posts, title]);
  };

  const handleRemoveInterestedPost = (post: string) => {
    setDraftPosts(posts.filter((p) => p !== post));
  };

  const handleSaveInterestedPosts = async () => {
    if (posts.length < MIN_INTERESTED_POSTS) return;
    setSavingPosts(true);
    try {
      const res = await profileService.updateProfile({ interested_posts: posts });
      setProfile((prev: any) => ({ ...prev, interested_posts: res.profile?.interested_posts ?? posts }));
      setDraftPosts(null);
    } catch (err) {
      Alert.alert("Couldn't save", err instanceof ApiError ? err.message : "Please try again.");
    } finally {
      setSavingPosts(false);
    }
  };

  const handleAttachPostDocument = async (post: string) => {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
      type: [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "image/png",
        "image/jpeg",
      ],
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setUploadingPost(post);
    try {
      // Tagged as this specific post's resume - shows as "attached" (green)
      // for this post going forward, without touching the default resume.
      await profileService.uploadDocument({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType }, "resume", post);
      await load();
    } catch (err) {
      Alert.alert("Upload failed", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setUploadingPost(null);
    }
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
        <Pressable onPress={handlePickAvatar} disabled={uploadingAvatar} style={styles.avatarLarge}>
          {profile.avatar_url ? (
            <Image source={{ uri: profileService.resolveAvatarUrl(profile.avatar_url) || undefined }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarLargeText}>{initial}</Text>
          )}
          <View style={styles.avatarEditBadge}>
            <Feather name="camera" size={11} color={colors.white} />
          </View>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroGreeting}>Hello, {profile.full_name || "there"}</Text>
          <Text style={styles.heroEmail}>{user?.email}</Text>
        </View>
      </Card>

      {/* Achievements */}
      {achievements.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Achievements</Text>
          <Card style={styles.achievementsCard}>
            {achievements.map((a) => (
              <View key={a.key} style={styles.achievementBadge}>
                <View style={[styles.achievementIcon, a.unlocked && styles.achievementIconUnlocked]}>
                  <Feather name={a.icon as any} size={18} color={a.unlocked ? colors.white : colors.textMuted} />
                </View>
                <Text style={[styles.achievementTitle, !a.unlocked && styles.achievementTitleLocked]} numberOfLines={1}>
                  {a.title}
                </Text>
                <Text style={styles.achievementProgress}>{a.progressLabel}</Text>
              </View>
            ))}
          </Card>
        </>
      )}

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

      {/* Section: Interested Posts */}
      <Text style={styles.sectionTitle}>Interested Job Posts</Text>
      <Card style={styles.listCard}>
        <ListRow
          icon="bookmark"
          title="Interested Posts"
          subtitle={
            savedPosts.length > 0
              ? `${savedPosts.length} post${savedPosts.length === 1 ? "" : "s"} saved`
              : "Add at least 5 roles you're targeting, with a resume for each"
          }
          onPress={() => setOpenSection(openSection === "interested" ? null : "interested")}
          expanded={openSection === "interested"}
        />
        {openSection === "interested" && (
          <View style={styles.expandedArea}>
            <View style={styles.addPostRow}>
              <View style={{ flex: 1 }}>
                <Input
                  value={newPostTitle}
                  onChangeText={setNewPostTitle}
                  placeholder="e.g. Backend Developer"
                  onSubmitEditing={handleAddInterestedPost}
                />
              </View>
              <Pressable onPress={handleAddInterestedPost} style={styles.addPostButton}>
                <Feather name="plus" size={18} color={colors.white} />
              </Pressable>
            </View>

            <Text style={styles.postsCounter}>
              {posts.length}/{MIN_INTERESTED_POSTS} minimum to save
              {postsDirty ? " · unsaved changes" : ""}
            </Text>

            {posts.length === 0 ? (
              <EmptyState
                title="No interested posts yet"
                description="Add job titles you're targeting - JobJet will only flag a company as a match when it actually has one of these roles open. You need at least 5 before they can be saved."
              />
            ) : (
              posts.map((post) => {
                const attachedDoc = documentForPost(post);
                const isUploading = uploadingPost === post;
                return (
                  <View key={post} style={styles.postRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.docName}>{post}</Text>
                      {attachedDoc ? (
                        <View style={styles.attachedRow}>
                          <Feather name="check-circle" size={13} color="#16A34A" />
                          <Text style={[styles.attachedText, { color: "#16A34A" }]} numberOfLines={1}>
                            {attachedDoc.name}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.docMeta}>No document attached yet</Text>
                      )}
                    </View>

                    {attachedDoc ? (
                      <Pressable onPress={() => handleAttachPostDocument(post)} disabled={isUploading} style={styles.docAction}>
                        <Text style={styles.docActionText}>{isUploading ? "..." : "Change"}</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => handleAttachPostDocument(post)}
                        disabled={isUploading}
                        style={styles.attachPill}
                      >
                        <Feather name="upload" size={12} color={colors.textPrimary} />
                        <Text style={styles.uploadPillText}>{isUploading ? "Uploading..." : "Attach"}</Text>
                      </Pressable>
                    )}
                    <Pressable onPress={() => handleRemoveInterestedPost(post)} style={styles.docAction}>
                      <Feather name="x" size={16} color={colors.textMuted} />
                    </Pressable>
                  </View>
                );
              })
            )}

            {postsDirty && (
              <Button
                label={posts.length < MIN_INTERESTED_POSTS ? `Add ${MIN_INTERESTED_POSTS - posts.length} more to save` : "Save Posts"}
                onPress={handleSaveInterestedPosts}
                loading={savingPosts}
                disabled={posts.length < MIN_INTERESTED_POSTS}
                style={{ marginTop: spacing.sm }}
              />
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
    position: "relative",
  },
  avatarLargeText: { ...typography.h2, color: colors.white },
  avatarImage: { width: 56, height: 56, borderRadius: 28 },
  avatarEditBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.textPrimary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.white,
  },
  heroGreeting: { ...typography.h3, color: colors.textPrimary },
  heroEmail: { ...typography.small, color: colors.textMuted, marginTop: 2 },

  achievementsCard: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, paddingVertical: spacing.md },
  achievementBadge: { width: 84, alignItems: "center", gap: 2 },
  achievementIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  achievementIconUnlocked: { backgroundColor: colors.primary },
  achievementTitle: { ...typography.tiny, color: colors.textPrimary, fontWeight: "700", textAlign: "center" },
  achievementTitleLocked: { color: colors.textMuted },
  achievementProgress: { ...typography.tiny, color: colors.textMuted },

  addPostRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  postsCounter: { ...typography.tiny, color: colors.textMuted, marginTop: spacing.xs },
  addPostButton: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  postRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  attachedRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  attachedText: { ...typography.small, color: colors.success, flexShrink: 1 },
  attachPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },

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
