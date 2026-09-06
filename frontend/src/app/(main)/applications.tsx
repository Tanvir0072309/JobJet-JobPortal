import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { StatusBadge } from "../../components/StatusBadge";
import { EmptyState } from "../../components/EmptyState";
import { LoadingState, ErrorState } from "../../components/LoadingState";
import {
  getSummary,
  listApplications,
  listUnreadReplies,
  type ApplicationSummary,
  type Application,
} from "../../services/applicationsService";
import { ApiError } from "../../services/api";
import { colors, spacing, typography } from "../../constants/jobjetTheme";

export default function ApplicationsScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [summary, setSummary] = useState<ApplicationSummary | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [unreadReplies, setUnreadReplies] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [summaryRes, appsRes, repliesRes] = await Promise.all([
        getSummary(),
        listApplications(),
        listUnreadReplies(),
      ]);
      setSummary(summaryRes.summary);
      setApplications(appsRes.applications);
      setUnreadReplies(repliesRes.replies);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your applications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  if (loading) return <LoadingState label="Loading your dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  const stats: { label: string; value: number }[] = [
    { label: "Total", value: summary?.total ?? 0 },
    { label: "Sent", value: summary?.sent ?? 0 },
    { label: "Replied", value: summary?.replied ?? 0 },
    { label: "Interview", value: summary?.interview ?? 0 },
    { label: "Rejected", value: summary?.rejected ?? 0 },
  ];

  return (
    <FlatList
      data={applications}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadData();
          }}
        />
      }
      ListHeaderComponent={
        <View>
          <View style={styles.statsRow}>
            {stats.map((stat, idx) => (
              <React.Fragment key={stat.label}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
                {idx < stats.length - 1 && <View style={styles.statDivider} />}
              </React.Fragment>
            ))}
          </View>

          {unreadReplies.length > 0 && (
            <View style={styles.replyBanner}>
              <Text style={styles.replyBannerText}>
                {unreadReplies.length} new {unreadReplies.length === 1 ? "reply" : "replies"} waiting in your inbox
              </Text>
              <Pressable onPress={() => router.push("/(main)/emails" as any)} hitSlop={8}>
                <Feather name="arrow-right" size={16} color={colors.white} />
              </Pressable>
            </View>
          )}

          <View style={styles.listHeaderRow}>
            <Text style={styles.listHeaderTitle}>Recent Applications</Text>
            <Pressable onPress={() => router.push("/(main)/find-companies" as any)} style={styles.findAction}>
              <Feather name="plus" size={16} color={colors.textPrimary} />
              <Text style={styles.findActionText}>Find companies</Text>
            </Pressable>
          </View>
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          title="No applications yet"
          description="Use Find companies above to search and apply with AI-generated emails."
        />
      }
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/(main)/emails/${item.id}` as any)}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(item.company_name || "?").trim().charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.rowMain}>
            <Text style={styles.company} numberOfLines={1}>
              {item.company_name || "Unknown company"}
            </Text>
            <Text style={styles.job} numberOfLines={1}>
              {item.job_title || "—"}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {item.recipient_email || "No recipient yet"}
            </Text>
          </View>
          <View style={styles.rowSide}>
            <StatusBadge status={item.status} />
            <Text style={styles.date}>{new Date(item.updated_at).toLocaleDateString()}</Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: spacing.xxl, maxWidth: 960, width: "100%", alignSelf: "center" },

  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  statItem: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, height: 28, backgroundColor: colors.border },
  statValue: { ...typography.h2, color: colors.textPrimary },
  statLabel: { ...typography.tiny, color: colors.textMuted, marginTop: 2 },

  replyBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.black,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: 10,
  },
  replyBannerText: { ...typography.small, color: colors.white, fontWeight: "600", flex: 1, marginRight: spacing.sm },

  listHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  listHeaderTitle: { ...typography.h3, color: colors.textPrimary },
  findAction: { flexDirection: "row", alignItems: "center", gap: 6 },
  findActionText: { ...typography.small, color: colors.textPrimary, fontWeight: "600" },

  separator: { height: 1, backgroundColor: colors.border, marginLeft: spacing.lg + 40 + spacing.md },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
  },
  rowPressed: { backgroundColor: colors.surfaceMuted },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarText: { ...typography.bodyBold, color: colors.textSecondary },
  rowMain: { flex: 1, marginRight: spacing.md, minWidth: 0 },
  company: { ...typography.bodyBold, color: colors.textPrimary },
  job: { ...typography.small, color: colors.textSecondary },
  meta: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  rowSide: { alignItems: "flex-end", gap: spacing.xs },
  date: { ...typography.tiny, color: colors.textMuted },
});
