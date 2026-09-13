import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { colors, typography } from "../constants/jobjetTheme";

function extractDomain(website?: string | null): string | null {
  if (!website) return null;
  try {
    const withScheme = website.startsWith("http") ? website : `https://${website}`;
    const host = new URL(withScheme).hostname.replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

type Props = {
  name: string;
  website?: string | null;
  size?: number;
  unread?: boolean;
};

// Company logos, next to each email in the inbox and each company card in
// Find Companies - uses Clearbit's free, keyless logo API (logo.clearbit.com)
// derived from the company's own website domain. If there's no website, or
// the logo fails to load (unknown domain, network hiccup), this quietly
// falls back to the same initials-in-a-circle avatar used everywhere else.
export function CompanyLogo({ name, website, size = 44, unread }: Props) {
  const domain = useMemo(() => extractDomain(website), [website]);
  const [failed, setFailed] = useState(false);
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";

  if (domain && !failed) {
    return (
      <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
        <Image
          source={{ uri: `https://logo.clearbit.com/${domain}?size=128` }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setFailed(true)}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.wrap,
        styles.initialsWrap,
        unread && styles.initialsWrapUnread,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.initialsText, unread && styles.initialsTextUnread, { fontSize: size * 0.4 }]}>
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  initialsWrap: { backgroundColor: colors.surfaceMuted },
  initialsWrapUnread: { backgroundColor: colors.black, borderColor: colors.black },
  initialsText: { ...typography.bodyBold, color: colors.textSecondary },
  initialsTextUnread: { color: colors.white },
});
