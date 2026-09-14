import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Card } from "../../components/Card";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import { useAuth } from "../../context/AuthContext";
import { sendManualEmail, draftMessageFromSubject } from "../../services/applicationsService";
import { listDocuments, type DocumentItem } from "../../services/documentsService";
import { ApiError } from "../../services/api";
import { colors, spacing, typography, radius } from "../../constants/jobjetTheme";

// How long to wait after the user stops typing the subject before we
// auto-draft the message body from it.
const SUBJECT_DRAFT_DELAY_MS = 3000;

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
  const [draftingMessage, setDraftingMessage] = useState(false);

  // Auto-draft the message body a few seconds after the user stops typing
  // the subject line - reads the subject (and, via the backend, the
  // profile/resume) and writes a first-pass message into the "Write
  // message" box so there's always something sensible there already.
  // Only ever overwrites what WE last auto-filled (or an empty box) - if
  // the person has since typed their own words in, their edits are never
  // clobbered by a later subject change.
  const messageRef = useRef<any>(null);
  const lastAutoBodyRef = useRef<string>("");
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSubjectChange = (value: string) => {
    setSubject(value);
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);

    const trimmed = value.trim();
    if (!trimmed) return;

    draftTimerRef.current = setTimeout(async () => {
      // Don't stomp on a message the user actually wrote themselves.
      if (message.trim() && message !== lastAutoBodyRef.current) return;
      setDraftingMessage(true);
      try {
        const res = await draftMessageFromSubject(trimmed);
        if (res.body) {
          lastAutoBodyRef.current = res.body;
          setMessage(res.body);
          messageRef.current?.focus?.();
        }
      } catch {
        // Non-fatal - auto-draft is a convenience, not a requirement.
      } finally {
        setDraftingMessage(false);
      }
    }, SUBJECT_DRAFT_DELAY_MS);
  };

  useEffect(() => {
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, []);

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
        <Input value={subject} onChangeText={handleSubjectChange} placeholder="Application for ..." />

        <View style={styles.messageLabelRow}>
          <Text style={styles.label}>Write message</Text>
          {draftingMessage ? <Text style={styles.draftingText}>Writing a message for you…</Text> : null}
        </View>
        <Input
          ref={messageRef}
          value={message}
          onChangeText={(value) => {
            setMessage(value);
          }}
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
                    <View style={{ flexShrink: 1 }}>
                      <Text style={styles.docPillText} numberOfLines={1}>
                        {doc.name}
                      </Text>
                      <Text style={styles.docPillMeta} numberOfLines={1}>
                        {doc.post_tag ? `For: ${doc.post_tag}` : doc.is_default ? "Default" : doc.document_type}
                      </Text>
                    </View>
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
  messageLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
  draftingText: { ...typography.small, color: colors.textMuted, fontStyle: "italic" },
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
  docPillMeta: { fontSize: 11, color: colors.textMuted },
  noticeBox: { borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.sm },
  noticeError: { backgroundColor: colors.dangerBg },
  noticeSuccess: { backgroundColor: "#DCFCE7" },
  noticeText: { ...typography.small },
  noticeTextError: { color: colors.danger },
  noticeTextSuccess: { color: "#16A34A" },
});
