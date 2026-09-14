import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Card } from "../../components/Card";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import { useAuth } from "../../context/AuthContext";
import { sendManualEmail } from "../../services/applicationsService";
import { listDocuments, type DocumentItem } from "../../services/documentsService";
import { ApiError } from "../../services/api";
import { colors, spacing, typography, radius } from "../../constants/jobjetTheme";

export default function SendEmailScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeIsError, setNoticeIsError] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await listDocuments();
      setDocuments(res.documents);
      // Drop any selected doc that no longer exists (e.g. it was deleted
      // from the Profile screen while this screen stayed open) - otherwise
      // a stale, already-deleted document id keeps getting sent with every
      // future email and can block sending entirely.
      setSelectedDocs((prev) => {
        const validIds = new Set(res.documents.map((d) => d.id));
        const next = new Set(Array.from(prev).filter((id) => validIds.has(id)));
        return next.size === prev.size ? prev : next;
      });
    } catch {
      // Non-fatal - attaching documents is optional here.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggleDoc = (id: string) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    setNotice(null);
    if (!to.trim() || !/^\S+@\S+\.\S+$/.test(to.trim())) {
      setNoticeIsError(true);
      setNotice("Please enter a valid recipient email.");
      return;
    }
    if (!message.trim()) {
      setNoticeIsError(true);
      setNotice("Write a message before sending.");
      return;
    }
    setSending(true);
    try {
      await sendManualEmail({
        to: to.trim(),
        subject: subject.trim(),
        body: message,
        documentIds: Array.from(selectedDocs),
      });
      setNoticeIsError(false);
      setNotice("Email sent!");
      setTo("");
      setSubject("");
      setMessage("");
      setSelectedDocs(new Set());
      setTimeout(() => router.push("/(main)/emails" as any), 700);
    } catch (err) {
      setNoticeIsError(true);
      setNotice(err instanceof ApiError ? err.message : "Couldn't send this email. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Card style={styles.card}>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>From</Text>
          <Text style={styles.fromValue} numberOfLines={1}>
            {user?.gmailEmail || user?.email || "Not connected"}
          </Text>
        </View>
        <View style={styles.divider} />

        <Text style={styles.label}>To</Text>
        <Input
          value={to}
          onChangeText={setTo}
          placeholder="recruiter@company.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Subject</Text>
        <Input value={subject} onChangeText={setSubject} placeholder="Application for ..." />

        <Text style={styles.label}>Write message</Text>
        <Input
          value={message}
          onChangeText={setMessage}
          placeholder="Write your email here..."
          multiline
          numberOfLines={10}
          style={styles.messageBox}
        />

        {documents.length > 0 ? (
          <>
            <Text style={styles.label}>Attach documents</Text>
            <View style={styles.docList}>
              {documents.map((doc) => {
                const checked = selectedDocs.has(doc.id);
                return (
                  <Pressable key={doc.id} onPress={() => toggleDoc(doc.id)} style={styles.docPill}>
                    <Feather
                      name={checked ? "check-circle" : "circle"}
                      size={16}
                      color={checked ? colors.success : colors.textMuted}
                    />
                    <Text style={styles.docPillText} numberOfLines={1}>
                      {doc.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {notice ? (
          <View style={[styles.noticeBox, noticeIsError ? styles.noticeError : styles.noticeSuccess]}>
            <Text style={[styles.noticeText, noticeIsError ? styles.noticeTextError : styles.noticeTextSuccess]}>
              {notice}
            </Text>
          </View>
        ) : null}

        <Button label="Send Email" onPress={handleSend} loading={sending} style={{ marginTop: spacing.md }} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, maxWidth: 720, width: "100%", alignSelf: "center", paddingBottom: spacing.xxl },
  card: { gap: spacing.xs },
  fieldRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.xs },
  fieldLabel: { ...typography.small, color: colors.textMuted, fontWeight: "700" },
  fromValue: { ...typography.bodyBold, color: colors.textPrimary, flexShrink: 1, marginLeft: spacing.sm },
  divider: { height: 1, backgroundColor: colors.border, marginBottom: spacing.sm },
  label: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.sm },
  messageBox: { minHeight: 180, textAlignVertical: "top" },
  docList: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  docPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    maxWidth: 220,
  },
  docPillText: { ...typography.small, color: colors.textPrimary },
  noticeBox: { borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.sm },
  noticeError: { backgroundColor: colors.dangerBg },
  noticeSuccess: { backgroundColor: "#DCFCE7" },
  noticeText: { ...typography.small },
  noticeTextError: { color: colors.danger },
  noticeTextSuccess: { color: "#16A34A" },
});
