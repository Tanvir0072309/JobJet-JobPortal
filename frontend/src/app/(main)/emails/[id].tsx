import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { StatusBadge } from "../../../components/StatusBadge";
import { LoadingState, ErrorState } from "../../../components/LoadingState";
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.backRow} hitSlop={8}>
        <Feather name="chevron-left" size={18} color={colors.textPrimary} />
        <Text style={styles.backLabel}>Inbox</Text>
      </Pressable>

      <View style={styles.subjectRow}>
        <Text style={styles.subject}>{application.subject || application.job_title || "Application"}</Text>
        <StatusBadge status={application.status} />
      </View>

      <View style={styles.senderRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(application.company_name || "?").charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.senderName}>{application.company_name || "Unknown company"}</Text>
          <Text style={styles.senderMeta} numberOfLines={1}>
            To: {application.recipient_email || "—"}
          </Text>
        </View>
        <Text style={styles.date}>
          {application.sent_at ? new Date(application.sent_at).toLocaleDateString() : ""}
        </Text>
      </View>

      <View style={styles.divider} />

      {thread.length === 0 ? (
        <Text style={styles.body}>{application.body || "No message content."}</Text>
      ) : (
        thread.map((message, index) => (
          <View key={message.id || index} style={styles.messageBlock}>
            <Text style={styles.messageMeta}>
              {message.direction === "inbound" ? application.company_name || "Them" : "You"} ·{" "}
              {message.created_at ? new Date(message.created_at).toLocaleString() : ""}
            </Text>
            <Text style={styles.body}>{message.body}</Text>
          </View>
        ))
      )}

      {attachments.length > 0 && (
        <View style={styles.attachmentsBlock}>
          <Text style={styles.attachmentsLabel}>Attachments</Text>
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
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xxl, maxWidth: 720, width: "100%", alignSelf: "center" },
  backRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md, gap: 2 },
  backLabel: { ...typography.body, color: colors.textPrimary },
  subjectRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm },
  subject: { ...typography.h1, color: colors.textPrimary, flex: 1 },
  senderRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.lg, gap: spacing.sm },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { ...typography.bodyBold, color: colors.textSecondary },
  senderName: { ...typography.bodyBold, color: colors.textPrimary },
  senderMeta: { ...typography.small, color: colors.textMuted },
  date: { ...typography.small, color: colors.textMuted },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
  messageBlock: { marginBottom: spacing.lg },
  messageMeta: { ...typography.tiny, color: colors.textMuted, marginBottom: spacing.xs, textTransform: "uppercase" },
  body: { ...typography.body, color: colors.textPrimary, lineHeight: 22 },

  attachmentsBlock: { marginTop: spacing.lg, gap: spacing.sm },
  attachmentsLabel: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.xs },
  attachmentRow: {
    flexDirection: "row",
    alignItems: "center",
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
