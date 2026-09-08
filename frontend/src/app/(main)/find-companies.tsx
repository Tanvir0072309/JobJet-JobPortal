import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { Card } from "../../components/Card";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { LoadingState } from "../../components/LoadingState";
import { listCompanies, discoverCompanies, type Company, type IndustryFocus } from "../../services/companiesService";
import { getProfile } from "../../services/profileService";
import { applyToCompanies, type ApplyResult } from "../../services/applicationsService";
import { ApiError } from "../../services/api";
import { getCached, setCached } from "../../utils/screenCache";
import { colors, spacing, typography, radius } from "../../constants/jobjetTheme";

const CACHE_KEY = "companies:list";

const FILTERS = ["Any", "Remote", "Hybrid", "On-site"] as const;
const INDUSTRY_OPTIONS: { value: IndustryFocus; label: string }[] = [
  { value: "it", label: "IT / Software" },
  { value: "management", label: "Management / Business" },
  { value: "any", label: "Any" },
];

export default function FindCompaniesScreen() {
  const params = useLocalSearchParams<{ location?: string; limit?: string }>();

  const [location, setLocation] = useState(params.location || "");
  const [limit, setLimit] = useState(params.limit ? Number(params.limit) : 20);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Any");
  const [industry, setIndustry] = useState<IndustryFocus>("any");

  const cachedCompanies = getCached<Company[]>(CACHE_KEY);
  const [loading, setLoading] = useState(cachedCompanies === undefined);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>(cachedCompanies || []);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [applyResults, setApplyResults] = useState<ApplyResult[] | null>(null);

  // This screen fully remounts every time you switch away from and back to
  // the Find Jobs tab (see screenCache.ts) - the cache above just lets that
  // remount show last-known data instantly instead of a spinner while this
  // refetch (still run on every focus, as before) completes quietly.
  const loadCompanies = useCallback(async () => {
    try {
      const res = await listCompanies();
      setCompanies(res.companies);
      setCached(CACHE_KEY, res.companies);
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Couldn't load companies.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCompanies();
    }, [loadCompanies])
  );

  // Default the industry focus to "IT / Software" for candidates whose
  // profile clearly reads as technical (has skills/languages/frameworks
  // listed) - anyone can still change it before searching.
  useEffect(() => {
    getProfile()
      .then(({ profile }) => {
        const looksTechnical =
          (profile?.programming_languages?.length || 0) > 0 || (profile?.frameworks?.length || 0) > 0;
        if (looksTechnical) setIndustry("it");
      })
      .catch(() => {
        // Non-fatal - just leave the default at "Any".
      });
  }, []);

  const handleSearch = async () => {
    if (!location.trim()) {
      setNotice("Please enter a location to search.");
      return;
    }
    setSearching(true);
    setNotice(null);
    try {
      // Asks Groq (your own API key from Settings) directly for real
      // companies near this location, their careers page, and a few
      // example open roles - no geocoding or map lookup needed.
      const res = await discoverCompanies(location.trim(), limit, industry);
      setNotice(res.message);
      await loadCompanies();
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Company discovery failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(companies.map((c) => c.id)));
  const clearSelection = () => setSelected(new Set());

  // A single tap here fires ONE request no matter how many companies are
  // selected - the backend loops internally, calling Tomba/Groq once per
  // company (only when needed), then sends each email with the attached
  // default resume/documents.
  const handleApplyWithAI = async () => {
    if (selected.size === 0) {
      setAiNotice("Select at least one company first.");
      return;
    }
    setAiLoading(true);
    setAiNotice(null);
    setApplyResults(null);
    try {
      const res = await applyToCompanies(Array.from(selected));
      setApplyResults(res.results);
      const sentCount = res.results.filter((r) => r.status === "sent").length;
      setAiNotice(`${sentCount} of ${res.results.length} application(s) sent.`);
      setSelected(new Set());
      await loadCompanies();
    } catch (err) {
      setAiNotice(err instanceof ApiError ? err.message : "Couldn't apply right now.");
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) return <LoadingState label="Loading companies..." />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.searchCard}>
        <Text style={styles.label}>Search location</Text>
        <Input value={location} onChangeText={setLocation} placeholder="Berlin, Germany" />

        <Text style={styles.label}>Company limit</Text>
        <Input
          value={String(limit)}
          onChangeText={(text) => setLimit(Number(text.replace(/[^0-9]/g, "")) || 0)}
          keyboardType="number-pad"
          placeholder="20"
        />

        <Text style={styles.label}>Filters</Text>
        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.filterPill, filter === f && styles.filterPillActive]}
            >
              <Text style={[styles.filterPillText, filter === f && styles.filterPillTextActive]}>{f}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Kind of company</Text>
        <View style={styles.filterRow}>
          {INDUSTRY_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => setIndustry(opt.value)}
              style={[styles.filterPill, industry === opt.value && styles.filterPillActive]}
            >
              <Text style={[styles.filterPillText, industry === opt.value && styles.filterPillTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Button label="Search Companies" onPress={handleSearch} loading={searching} style={styles.searchButton} />

        {notice ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}
      </Card>

      <View style={styles.actionsRow}>
        <Pressable onPress={selectAll}>
          <Text style={styles.actionLink}>Select All</Text>
        </Pressable>
        <Pressable onPress={clearSelection}>
          <Text style={styles.actionLink}>Clear Selection</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Button
          label={`Apply (${selected.size})`}
          onPress={handleApplyWithAI}
          loading={aiLoading}
          disabled={selected.size === 0}
        />
      </View>

      {aiNotice ? (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>{aiNotice}</Text>
        </View>
      ) : null}

      {applyResults ? (
        <Card style={{ gap: spacing.xs }}>
          {applyResults.map((r) => (
            <View key={r.companyId} style={styles.resultRow}>
              <Text style={styles.companyName}>{r.company || r.companyId}</Text>
              <Text
                style={[
                  styles.companyMeta,
                  r.status === "sent" && { color: colors.success, fontWeight: "700" },
                  r.status === "error" && { color: colors.danger, fontWeight: "700" },
                ]}
              >
                {r.status === "sent" ? `Sent to ${r.to}` : r.message || r.status}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      {companies.length === 0 ? (
        <EmptyState
          title="No companies yet"
          description="Search a location above to discover companies. Results, career pages, and example roles are generated by Groq AI using your own API key from Settings."
        />
      ) : (
        companies.map((company) => (
          <Pressable
            key={company.id}
            onPress={() => toggleSelect(company.id)}
            style={[styles.companyCard, selected.has(company.id) && styles.companyCardSelected]}
          >
            <View style={styles.companyHeaderRow}>
              <View style={[styles.checkbox, selected.has(company.id) && styles.checkboxChecked]} />
              <Text style={styles.companyName}>{company.name}</Text>
            </View>
            <Text style={styles.companyMeta}>{company.location || "Location unknown"}</Text>
            {company.website ? <Text style={styles.companyMeta}>{company.website}</Text> : null}
            {company.career_page_url ? (
              <Text style={styles.companyMetaLink}>{company.career_page_url}</Text>
            ) : null}

            {company.career_details_extracted ? (
              <Text style={styles.companyMeta}>
                {company.jobs && company.jobs.length > 0
                  ? company.jobs.map((j: any) => j.title).join(", ")
                  : "No open roles found"}
              </Text>
            ) : (
              <Text style={styles.companyMetaMuted}>Career details could not be extracted</Text>
            )}

            {company.contacts && company.contacts.length > 0 ? (
              <Text style={styles.companyMeta}>{company.contacts[0].email}</Text>
            ) : (
              <Text style={styles.companyMetaMuted}>No contact email found</Text>
            )}
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md, maxWidth: 960, width: "100%", alignSelf: "center" },
  searchCard: { gap: spacing.xs },
  label: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.sm },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm },
  filterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterPillText: { ...typography.small, color: colors.textPrimary },
  filterPillTextActive: { color: colors.white, fontWeight: "700" },
  searchButton: { marginTop: spacing.sm },
  noticeBox: {
    backgroundColor: colors.warningBg,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  noticeText: { ...typography.small, color: colors.warning },

  actionsRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  actionLink: { ...typography.small, color: colors.textPrimary, fontWeight: "700" },

  companyCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  companyCardSelected: { borderColor: colors.primary, backgroundColor: colors.surfaceTintBlue },
  companyHeaderRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: colors.borderStrong },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  companyName: { ...typography.bodyBold, color: colors.textPrimary },
  companyMeta: { ...typography.small, color: colors.textSecondary },
  companyMetaLink: { ...typography.small, color: colors.primary },
  companyMetaMuted: { ...typography.small, color: colors.textMuted, fontStyle: "italic" },
  resultRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: spacing.xs, gap: 2 },
});
