import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Card } from "../../components/Card";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { searchRealJobs, type RealJob } from "../../services/jobsService";
import { ApiError } from "../../services/api";
import { colors, spacing, typography, radius } from "../../constants/jobjetTheme";

// Career page's job openings finder - unlike Find Jobs (which asks an AI to
// guess plausible companies/roles), every result here is a REAL, currently
// open posting pulled straight from a live public job board, with a genuine
// apply link. No AI, no guessing, no API key needed from the user.
export default function CareerScreen() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [jobs, setJobs] = useState<RealJob[]>([]);

  const handleSearch = async () => {
    setSearching(true);
    setNotice(null);
    try {
      const res = await searchRealJobs({ query: query.trim(), location: location.trim(), remoteOnly });
      setJobs(res.jobs || []);
      setNotice(res.message);
      setSearched(true);
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Couldn't load job openings. Please try again.");
      setJobs([]);
      setSearched(true);
    } finally {
      setSearching(false);
    }
  };

  const openJob = (url: string) => {
    if (url) Linking.openURL(url).catch(() => {});
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.searchCard}>
        <Text style={styles.title}>Job Openings</Text>
        <Text style={styles.subtitle}>Real, currently open roles from a live job board - not AI guesses.</Text>

        <Text style={styles.label}>Role / keyword</Text>
        <Input value={query} onChangeText={setQuery} placeholder="e.g. React developer" autoCapitalize="none" />

        <Text style={styles.label}>Location (optional)</Text>
        <Input value={location} onChangeText={setLocation} placeholder="e.g. Berlin, or leave blank" autoCapitalize="none" />

        <Pressable style={styles.remoteToggle} onPress={() => setRemoteOnly((v) => !v)}>
          <Feather
            name={remoteOnly ? "check-square" : "square"}
            size={18}
            color={remoteOnly ? colors.primary : colors.textMuted}
          />
          <Text style={styles.remoteToggleText}>Remote only</Text>
        </Pressable>

        <Button label="Find Job Openings" onPress={handleSearch} loading={searching} style={styles.searchButton} />

        {notice ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}
      </Card>

      {!searched ? (
        <EmptyState
          title="Search for real job openings"
          description="Enter a role and optionally a location to see genuinely open positions with a working apply link."
        />
      ) : jobs.length === 0 ? (
        <EmptyState title="No openings found" description="Try a different keyword, clear the location, or turn off Remote only." />
      ) : (
        jobs.map((job) => (
          <Pressable key={job.id} onPress={() => openJob(job.applyUrl)} style={styles.jobCard}>
            <View style={styles.jobHeaderRow}>
              <Text style={styles.jobTitle} numberOfLines={2}>
                {job.title}
              </Text>
              {job.remote ? (
                <View style={styles.remoteBadge}>
                  <Text style={styles.remoteBadgeText}>Remote</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.company}>{job.company}</Text>
            <Text style={styles.meta}>{job.location}</Text>
            {job.tags?.length ? (
              <View style={styles.tagRow}>
                {job.tags.slice(0, 5).map((tag) => (
                  <View key={tag} style={styles.tagPill}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={styles.applyRow}>
              <Text style={styles.applyLink}>Apply on employer site</Text>
              <Feather name="external-link" size={14} color={colors.primary} />
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md, maxWidth: 960, width: "100%", alignSelf: "center" },
  searchCard: { gap: spacing.xs },
  title: { ...typography.h2, color: colors.textPrimary },
  subtitle: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.sm },
  label: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.sm },
  remoteToggle: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.sm },
  remoteToggleText: { ...typography.small, color: colors.textPrimary },
  searchButton: { marginTop: spacing.md },
  noticeBox: { backgroundColor: colors.warningBg, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.sm },
  noticeText: { ...typography.small, color: colors.warning },

  jobCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  jobHeaderRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  jobTitle: { ...typography.bodyBold, color: colors.textPrimary, flex: 1 },
  company: { ...typography.small, color: colors.textSecondary, fontWeight: "700" },
  meta: { ...typography.small, color: colors.textMuted },
  remoteBadge: { backgroundColor: colors.surfaceTintBlue, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  remoteBadgeText: { ...typography.tiny, color: colors.primary, fontWeight: "700" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  tagPill: { backgroundColor: colors.surfaceMuted, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { ...typography.tiny, color: colors.textSecondary },
  applyRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: spacing.xs },
  applyLink: { ...typography.small, color: colors.primary, fontWeight: "700" },
});
