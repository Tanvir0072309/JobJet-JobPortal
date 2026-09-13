import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { StatusBadge } from "../../../components/StatusBadge";
import { LoadingState, ErrorState } from "../../../components/LoadingState";
import { CompanyLogo } from "../../../components/CompanyLogo";
import { getThread } from "../../../services/emailsService";
import { markThreadRead, type Application } from "../../../services/applicationsService";
import { listDocuments, type DocumentItem } from "../../../services/documentsService";
import { ApiError } from "../../../services/api";
import { colors, spacing, typography, radius } from "../../../constants/jobjetTheme";

function formatBytes(bytes: number) {
  if (!bytes) return "0 KB";
  const kb = bytes / 1024;
  return kb > 999 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(0)} KB`;
}

function fileKind(fileType: string) {
  if (fileType?.includes("pdf")) return "PDF";
  if (fileType?.includes("word") || fileType?.includes("doc")) return "DOC";
  return "FILE";
}

export default function EmailThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [thread, setThread] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<DocumentItem[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [threadRes, docsRes] = await Promise.all([getThread(id), listDocuments()]);
      setApplication(threadRes.application);
      setThread(threadRes.thread || []);
      setAttachments(docsRes.documents.filter((d) => d.is_default));
      if (threadRes.application?.has_unread_reply) {
        markThreadRead(id).catch(() => {});
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load this conversation.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) return <LoadingState label="Loading conversation..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!application) return <ErrorState message="Conversation not found." />;

  const companyName = application.company_name || "Unknown company";

  return (
    <View style={styles.flex}>
      {/* Gmail-style top bar: back / archive / delete style icon row */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.topBarIcon}>
          <Feather name="arrow-left" size={20} color={colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <StatusBadge status={application.status} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.subject}>{application.subject || application.job_title || "Application"}</Text>

        {/* Sender card - the part that should feel like a real Gmail thread */}
        <View style={styles.senderCard}>
          <CompanyLogo name={companyName} website={(application as any).company_website} size={44} />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <View style={styles.senderTopLine}>
              <Text style={styles.senderName} numberOfLines={1}>
                {companyName}
              </Text>
              <Text style={styles.date}>
                {application.sent_at ? new Date(application.sent_at).toLocaleDateString() : ""}
              </Text>
            </View>
            <Text style={styles.senderMeta} numberOfLines={1}>
              to {application.recipient_email || "—"}
            </Text>
          </View>
        </View>

        {thread.length === 0 ? (
          <View style={styles.messageCard}>
            <Text style={styles.body}>{application.body || "No message content."}</Text>
          </View>
        ) : (
          thread.map((message, index) => (
            <View key={message.id || index} style={styles.messageCard}>
              <View style={styles.messageHeaderRow}>
                <CompanyLogo
                  name={message.direction === "inbound" ? companyName : "You"}
                  website={message.direction === "inbound" ? (application as any).company_website : null}
                  size={28}
                />
                <View style={{ flex: 1, marginLeft: spacing.xs }}>
                  <Text style={styles.messageMeta}>
                    {message.direction === "inbound" ? companyName : "You"}
                  </Text>
                  <Text style={styles.messageMetaSub}>
                    {message.created_at ? new Date(message.created_at).toLocaleString() : ""}
                  </Text>
                </View>
              </View>
              <Text style={styles.body}>{message.body}</Text>
            </View>
          ))
        )}

        {attachments.length > 0 && (
          <View style={styles.attachmentsBlock}>
            <Text style={styles.attachmentsLabel}>
              {attachments.length} Attachment{attachments.length === 1 ? "" : "s"}
            </Text>
            <View style={styles.attachmentsGrid}>
              {attachments.map((doc) => (
                <View key={doc.id} style={styles.attachmentRow}>
                  <View style={styles.attachmentIcon}>
                    <Text style={styles.attachmentIconText}>{fileKind(doc.file_type)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attachmentName} numberOfLines={1}>
                      {doc.name}
                    </Text>
                    <Text style={styles.attachmentMeta}>
                      {fileKind(doc.file_type)} · {formatBytes(doc.file_size_bytes)}
                    </Text>
                  </View>
                  <Feather name="download" size={18} color={colors.textSecondary} />
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topBarIcon: { padding: spacing.xs },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl, maxWidth: 720, width: "100%", alignSelf: "center" },
  subject: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.md },

  senderCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  senderTopLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  senderName: { ...typography.bodyBold, color: colors.textPrimary, flexShrink: 1, marginRight: spacing.sm },
  senderMeta: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  date: { ...typography.small, color: colors.textMuted },

  messageCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  messageHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  messageMeta: { ...typography.small, color: colors.textPrimary, fontWeight: "700" },
  messageMetaSub: { ...typography.tiny, color: colors.textMuted, marginTop: 1 },
  body: { ...typography.body, color: colors.textPrimary, lineHeight: 22 },

  attachmentsBlock: { marginTop: spacing.sm, gap: spacing.sm },
  attachmentsLabel: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.xs },
  attachmentsGrid: { gap: spacing.sm },
  attachmentRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  attachmentIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.black,
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentIconText: { ...typography.tiny, color: colors.white, fontWeight: "700" },
  attachmentName: { ...typography.bodyBold, color: colors.textPrimary },
  attachmentMeta: { ...typography.small, color: colors.textMuted },
});
