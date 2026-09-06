import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useFocusEffect } from "expo-router";
import { Card } from "../../components/Card";
import { LoadingState, ErrorState } from "../../components/LoadingState";
import { EmptyState } from "../../components/EmptyState";
import { getSummary, listApplications, type ApplicationSummary } from "../../services/applicationsService";
import { listCompanies, type Company } from "../../services/companiesService";
import { ApiError } from "../../services/api";
import { colors, spacing, typography } from "../../constants/jobjetTheme";

type ActivityItem = { id: string; text: string; timestamp: string };

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ApplicationSummary | null>(null);
  const [companiesDiscovered, setCompaniesDiscovered] = useState(0);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  const load = useCallback(async () => {
    try {
      const [summaryRes, appsRes, companiesRes] = await Promise.all([
        getSummary(),
        listApplications(),
        listCompanies(),
      ]);
      setSummary(summaryRes.summary);
      setCompaniesDiscovered(companiesRes.companies.length);
      setActivity(buildActivityFeed(appsRes.applications, companiesRes.companies));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) return <LoadingState label="Loading dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.statsGrid}>
        <StatCard label="Companies Discovered" value={companiesDiscovered} />
        <StatCard label="Total Applications" value={summary?.total ?? 0} />
        <StatCard label="Applications Sent" value={summary?.sent ?? 0} />
        <StatCard label="Replies" value={summary?.replied ?? 0} />
        <StatCard label="Interviews" value={summary?.interview ?? 0} />
        <StatCard label="Rejections" value={summary?.rejected ?? 0} />
      </View>

      <Text style={styles.sectionTitle}>Recent Activity</Text>
      {activity.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description="Once you discover companies and send applications, your recent activity will show up here."
        />
      ) : (
        <Card>
          {activity.map((item, idx) => (
            <View key={item.id} style={[styles.activityRow, idx > 0 && styles.activityRowBorder]}>
              <Text style={styles.activityText}>{item.text}</Text>
              <Text style={styles.activityTime}>{new Date(item.timestamp).toLocaleString()}</Text>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

function buildActivityFeed(applications: any[], companies: Company[]): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const app of applications) {
    const company = app.company_name || "a company";
    if (app.status === "sent" || app.sent_at) {
      items.push({ id: `sent-${app.id}`, text: `Application sent to ${company}`, timestamp: app.sent_at || app.updated_at });
    }
    if (app.status === "replied" || app.has_unread_reply) {
      items.push({ id: `reply-${app.id}`, text: `Reply received from ${company}`, timestamp: app.updated_at });
    }
    if (app.status === "generated") {
      items.push({ id: `gen-${app.id}`, text: `Application generated for ${company}`, timestamp: app.updated_at });
    }
  }

  for (const company of companies) {
    items.push({
      id: `discovered-${company.id}`,
      text: `New company discovered: ${company.name}`,
      timestamp: (company as any).created_at,
    });
  }

  return items
    .filter((i) => i.timestamp)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 15);
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg, maxWidth: 960, width: "100%", alignSelf: "center" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statCard: { flexGrow: 1, minWidth: 150, alignItems: "center", paddingVertical: spacing.lg },
  statValue: { ...typography.h1, color: colors.textPrimary },
  statLabel: { ...typography.small, color: colors.textSecondary, marginTop: 2, textAlign: "center" },
  sectionTitle: { ...typography.h2, color: colors.textPrimary },
  activityRow: { paddingVertical: spacing.sm },
  activityRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  activityText: { ...typography.body, color: colors.textPrimary },
  activityTime: { ...typography.tiny, color: colors.textMuted, marginTop: 2 },
});
