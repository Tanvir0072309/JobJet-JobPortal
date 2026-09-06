import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { colors } from "../constants/jobjetTheme";

// Real JobJet logo mark (navy plane + teal/pink contrail), provided as an
// asset at assets/images/jobjet-logo.png.
const logoSource = require("../../assets/images/jobjet-logo.png");

export function JobJetMark({ size = 28 }: { size?: number }) {
  return (
    <Image
      source={logoSource}
      style={{ width: size, height: size, borderRadius: size * 0.22 }}
      contentFit="cover"
    />
  );
}

export function JobJetLogo({ size = 28, showWordmark = true }: { size?: number; showWordmark?: boolean }) {
  return (
    <View style={styles.row}>
      <JobJetMark size={size} />
      {showWordmark && <Text style={[styles.wordmark, { fontSize: size * 0.62 }]}>JobJet</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  wordmark: {
    fontWeight: "700",
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
});
