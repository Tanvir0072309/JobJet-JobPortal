import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { EmptyState } from "../../../components/EmptyState";
import { LoadingState, ErrorState } from "../../../components/LoadingState";
import { listInbox, checkReplies, type InboxItem } from "../../../services/emailsService";
import { ApiError } from "../../../services/api";
import { getCached, setCached } from "../../../utils/screenCache";
import { colors, spacing, typography } from "../../../constants/jobjetTheme";

const CACHE_KEY = "inbox:items";

function initials(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function EmailsInboxScreen() {
  const router = useRouter();
  const cachedItems = getCached<InboxItem[]>(CACHE_KEY);
  const [loading, setLoading] = useState(cachedItems === undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkNotice, setCheckNotice] = useState<string | null>(null);
  const [items, setItems] = useState<InboxItem[]>(cachedItems || []);

  // Note: this screen fully remounts every time you leave and come back to
  // the Mail tab (see screenCache.ts for why), so `load()` runs again on
  // every focus regardless of the cache - the cache only controls whether
  // we show the spinner or last-known data while that refetch is in flight.
  const load = useCallback(async () => {
    setError(null);
    try {
      const inbox = await listInbox();
      setItems(inbox);
      setCached(CACHE_KEY, inbox);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your inbox.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refreshes the inbox list. Reply-checking itself no longer does
  // anything server-side (JobJet's Gmail connection is send-only by
  // design - see emailsService.checkReplies), so this mainly just re-pulls
  // whatever's already stored.
  const checkForReplies = useCallback(async () => {
    setChecking(true);
    setCheckNotice(null);
    try {
      const res = await checkReplies();
      setCheckNotice(res.newReplies > 0 ? `${res.newReplies} new repl${res.newReplies === 1 ? "y" : "ies"} found.` : res.message || "No new replies.");
      await load();
    } catch (err) {
      setCheckNotice(err instanceof ApiError ? err.message : "Couldn't check for replies right now.");
    } finally {
      setChecking(false);
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) return <LoadingState label="Loading your inbox..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            checkForReplies();
          }}
        />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          {items.length > 0 ? <Text style={styles.headerCount}>{items.filter((i) => i.unread).length} unread</Text> : <View />}
          <Pressable onPress={checkForReplies} disabled={checking} hitSlop={8} style={styles.checkRepliesRow}>
            <Feather name="refresh-cw" size={14} color={colors.textSecondary} />
            <Text style={styles.checkRepliesText}>{checking ? "Checking..." : "Check for replies"}</Text>
          </Pressable>
        </View>
      }
      ListFooterComponent={
        checkNotice ? (
          <Text style={styles.checkNotice}>{checkNotice}</Text>
        ) : null
      }
      ListEmptyComponent={
        <EmptyState
          title="No emails yet"
          description="Once you apply to a company, the conversation will show up here."
        />
      }
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/(main)/emails/${item.id}` as any)}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <View style={[styles.avatar, item.unread && styles.avatarUnread]}>
            <Text style={[styles.avatarText, item.unread && styles.avatarTextUnread]}>
              {initials(item.sender)}
            </Text>
          </View>
          <View style={styles.rowMain}>
            <View style={styles.rowTopLine}>
              <Text style={[styles.sender, item.unread && styles.textUnread]} numberOfLines={1}>
                {item.sender}
              </Text>
              <Text style={[styles.date, item.unread && styles.textUnread]}>{formatDate(item.date)}</Text>
            </View>
            <Text style={[styles.subject, item.unread && styles.textUnread]} numberOfLines={1}>
              {item.subject}
            </Text>
            <Text style={styles.snippet} numberOfLines={1}>
              {item.snippet}
            </Text>
          </View>
          {item.unread && <View style={styles.dot} />}
          <Feather name="chevron-right" size={16} color={colors.textMuted} style={{ marginLeft: spacing.xs }} />
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: spacing.xxl, maxWidth: 960, width: "100%", alignSelf: "center" },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerCount: { ...typography.small, color: colors.textMuted },
  checkRepliesRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  checkRepliesText: { ...typography.small, color: colors.textSecondary },
  checkNotice: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: spacing.md,
  },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: spacing.lg + 44 + spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
  },
  rowPressed: { backgroundColor: colors.surfaceMuted },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarUnread: { backgroundColor: colors.black, borderColor: colors.black },
  avatarText: { ...typography.bodyBold, color: colors.textSecondary },
  avatarTextUnread: { color: colors.white },
  rowMain: { flex: 1, minWidth: 0 },
  rowTopLine: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  sender: { ...typography.bodyBold, color: colors.textPrimary, flexShrink: 1, marginRight: spacing.sm },
  date: { ...typography.tiny, color: colors.textMuted },
  subject: { ...typography.body, color: colors.textPrimary, marginBottom: 2 },
  snippet: { ...typography.small, color: colors.textMuted },
  textUnread: { color: colors.black, fontWeight: "700" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.black, marginLeft: spacing.sm },
});
