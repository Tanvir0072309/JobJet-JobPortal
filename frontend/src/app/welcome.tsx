import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { JobJetMark } from "../components/JobJetLogo";
import { colors, gradients, spacing, typography, radius } from "../constants/jobjetTheme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const office1 = require("../../assets/images/onboarding/office-1.jpg");
const office2 = require("../../assets/images/onboarding/office-2.jpg");
const office3 = require("../../assets/images/onboarding/office-3.jpg");
const personImage = require("../../assets/images/onboarding/person.png");

type Slide = {
  key: string;
  kicker: string;
  title: string;
  boldWord: string;
  subtitle?: string;
  variant: "light" | "cards" | "dark";
};

const SLIDES: Slide[] = [
  {
    key: "discover",
    kicker: "",
    title: "Empower Your Job Search With ",
    boldWord: "Automation",
    variant: "light",
  },
  {
    key: "companies",
    kicker: "",
    title: "Discover Companies With ",
    boldWord: "One Click",
    subtitle: "Search real companies near any location, find a real contact, and skip the endless job-board scrolling.",
    variant: "cards",
  },
  {
    key: "apply",
    kicker: "",
    title: "Stay Ahead And ",
    boldWord: "Land The Job",
    subtitle: "AI writes your pitch, your inbox sends it, and every reply is tracked automatically.",
    variant: "dark",
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const goTo = useCallback((i: number) => {
    scrollRef.current?.scrollTo({ x: i * SCREEN_WIDTH, animated: true });
    setIndex(i);
  }, []);

  const handleMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setIndex(newIndex);
  }, []);

  const handleNext = useCallback(() => {
    if (index < SLIDES.length - 1) {
      goTo(index + 1);
    } else {
      router.push("/register");
    }
  }, [index, goTo, router]);

  const handleSkip = useCallback(() => {
    router.push("/register");
  }, [router]);

  const isDark = SLIDES[index].variant === "dark";

  return (
    <View style={styles.flex}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
        style={styles.flex}
      >
        {SLIDES.map((slide) => (
          <SlidePanel key={slide.key} slide={slide} insets={insets} />
        ))}
      </ScrollView>

      {/* Shared footer: page dots + skip + next, overlaid on every slide so
          position never jumps between light/dark panels. */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]} pointerEvents="box-none">
        <Pressable onPress={handleSkip} hitSlop={12}>
          <Text style={[styles.skipText, isDark && styles.skipTextDark]}>Skip</Text>
        </Pressable>

        <View style={styles.dots}>
          {SLIDES.map((slide, i) => (
            <View
              key={slide.key}
              style={[
                styles.dot,
                isDark && i !== index && styles.dotDark,
                i === index && (isDark ? styles.dotActiveDark : styles.dotActive),
              ]}
            />
          ))}
        </View>

        <Pressable onPress={handleNext} style={styles.nextButton}>
          <LinearGradient colors={gradients.accent} style={styles.nextButtonGradient}>
            <Feather name="arrow-right" size={22} color={colors.white} />
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function SlidePanel({ slide, insets }: { slide: Slide; insets: { top: number; bottom: number } }) {
  if (slide.variant === "light") {
    return (
      <View style={[styles.panel, styles.panelLight]}>
        <View pointerEvents="none" style={styles.watermarkWrap}>
          <JobJetMark size={SCREEN_WIDTH * 1.1} />
        </View>
        <View style={[styles.panelContent, { paddingTop: insets.top + spacing.xxl }]}>
          <Text style={styles.title}>
            {slide.title}
            <Text style={styles.titleBold}>{slide.boldWord}</Text>
          </Text>
          {slide.subtitle ? <Text style={styles.subtitle}>{slide.subtitle}</Text> : null}
        </View>
      </View>
    );
  }

  if (slide.variant === "cards") {
    return (
      <View style={[styles.panel, styles.panelLight]}>
        <View style={[styles.cardStack, { marginTop: insets.top + spacing.xxl }]}>
          <Image source={office3} style={[styles.stackImage, styles.stackImageBack]} contentFit="cover" />
          <Image source={office1} style={[styles.stackImage, styles.stackImageMid]} contentFit="cover" />
          <Image source={office2} style={[styles.stackImage, styles.stackImageFront]} contentFit="cover" />
        </View>
        <View style={styles.panelContentLower}>
          <Text style={styles.title}>
            {slide.title}
            <Text style={styles.titleBold}>{slide.boldWord}</Text>
          </Text>
          {slide.subtitle ? <Text style={styles.subtitle}>{slide.subtitle}</Text> : null}
        </View>
      </View>
    );
  }

  return (
    <LinearGradient colors={gradients.brand} style={styles.panel}>
      <View pointerEvents="none" style={styles.heroGlowOne} />
      <View pointerEvents="none" style={styles.heroGlowTwo} />
      <View style={styles.personWrap}>
        <Image source={personImage} style={styles.personImage} contentFit="contain" />
      </View>
      <View style={styles.panelContentLower}>
        <Text style={[styles.title, styles.titleLight]}>
          {slide.title}
          <Text style={[styles.titleBold, styles.titleBoldLight]}>{slide.boldWord}</Text>
        </Text>
        {slide.subtitle ? <Text style={[styles.subtitle, styles.subtitleLight]}>{slide.subtitle}</Text> : null}
      </View>
    </LinearGradient>
  );
}

const FOOTER_HEIGHT = 100;

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.white },
  panel: {
    width: SCREEN_WIDTH,
    flex: 1,
    overflow: "hidden",
  },
  panelLight: { backgroundColor: colors.white },
  watermarkWrap: {
    position: "absolute",
    bottom: -SCREEN_WIDTH * 0.28,
    left: -SCREEN_WIDTH * 0.22,
    opacity: 0.08,
    transform: [{ rotate: "-14deg" }],
  },
  panelContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  panelContentLower: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    paddingBottom: FOOTER_HEIGHT + spacing.lg,
  },
  title: {
    ...typography.h1,
    fontSize: 32,
    lineHeight: 40,
    color: colors.textPrimary,
  },
  titleBold: {
    ...typography.h1,
    fontSize: 32,
    lineHeight: 40,
    color: colors.primary,
    fontWeight: "800",
  },
  titleLight: { color: colors.white },
  titleBoldLight: { color: colors.primaryLight },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
    maxWidth: 340,
  },
  subtitleLight: { color: "rgba(255,255,255,0.85)" },

  cardStack: {
    height: SCREEN_WIDTH * 0.78,
    alignItems: "center",
    justifyContent: "center",
  },
  stackImage: {
    position: "absolute",
    width: SCREEN_WIDTH * 0.58,
    height: SCREEN_WIDTH * 0.58,
    borderRadius: radius.lg,
    borderWidth: 4,
    borderColor: colors.white,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  stackImageBack: { transform: [{ rotate: "-10deg" }, { translateX: -60 }, { translateY: 10 }] },
  stackImageMid: { transform: [{ rotate: "6deg" }, { translateX: 55 }, { translateY: -6 }] },
  stackImageFront: { transform: [{ rotate: "-2deg" }, { translateY: 34 }] },

  personWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingTop: spacing.xxl,
  },
  personImage: {
    width: SCREEN_WIDTH * 0.82,
    height: SCREEN_WIDTH * 1.05,
  },

  heroGlowOne: {
    position: "absolute",
    top: -60,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  heroGlowTwo: {
    position: "absolute",
    bottom: -40,
    left: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: FOOTER_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
  },
  skipText: { ...typography.bodyBold, color: colors.textSecondary },
  skipTextDark: { color: "rgba(255,255,255,0.85)" },
  dots: { flexDirection: "row", gap: 6 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotDark: { backgroundColor: "rgba(255,255,255,0.35)" },
  dotActive: { backgroundColor: colors.primary, width: 20 },
  dotActiveDark: { backgroundColor: colors.white, width: 20 },
  nextButton: { borderRadius: radius.full },
  nextButtonGradient: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
});
