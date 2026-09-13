// Achievements are derived entirely from applications the candidate has
// actually sent (application.sent_at) - no separate tracking table needed.
// Kept deliberately simple/heuristic (e.g. "country" is guessed from the
// last comma-separated part of a company's location) since this is a
// motivational/fun feature, not a precise analytics one.

export type Achievement = {
  key: string;
  icon: string; // Feather icon name
  title: string;
  description: string;
  unlocked: boolean;
  progressLabel: string;
};

function toDateKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10); // YYYY-MM-DD, local-agnostic but consistent
}

function guessCountry(location?: string | null): string | null {
  if (!location) return null;
  const parts = location.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  return parts[parts.length - 1];
}

function longestCurrentStreak(dateKeys: Set<string>): number {
  if (dateKeys.size === 0) return 0;
  let streak = 0;
  const cursor = new Date();
  // Walk backward from today; a streak "counts" as long as every day back
  // to today (or yesterday, if nothing was sent yet today) has a send.
  cursor.setHours(0, 0, 0, 0);
  if (!dateKeys.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (dateKeys.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function buildAchievements(applications: any[]): { achievements: Achievement[]; stats: any } {
  const sent = applications.filter((a) => a.sent_at);
  const totalSent = sent.length;

  const byDay = new Map<string, number>();
  const countries = new Set<string>();

  for (const app of sent) {
    const key = toDateKey(app.sent_at);
    byDay.set(key, (byDay.get(key) || 0) + 1);
    const country = guessCountry(app.company_location);
    if (country) countries.add(country);
  }

  const bestDay = byDay.size ? Math.max(...byDay.values()) : 0;
  const streak = longestCurrentStreak(new Set(byDay.keys()));
  const countryCount = countries.size;

  const achievements: Achievement[] = [
    {
      key: "first_step",
      icon: "flag",
      title: "First Step",
      description: "Sent your first application",
      unlocked: totalSent >= 1,
      progressLabel: `${Math.min(totalSent, 1)}/1`,
    },
    {
      key: "getting_started",
      icon: "trending-up",
      title: "Getting Started",
      description: "Sent 5 applications",
      unlocked: totalSent >= 5,
      progressLabel: `${Math.min(totalSent, 5)}/5`,
    },
    {
      key: "century_club",
      icon: "star",
      title: "Century Club",
      description: "Sent 100 applications",
      unlocked: totalSent >= 100,
      progressLabel: `${Math.min(totalSent, 100)}/100`,
    },
    {
      key: "power_day",
      icon: "zap",
      title: "Power Day",
      description: "25+ applications sent in a single day",
      unlocked: bestDay >= 25,
      progressLabel: `${Math.min(bestDay, 25)}/25`,
    },
    {
      key: "on_fire",
      icon: "activity",
      title: "On Fire",
      description: "3-day applying streak",
      unlocked: streak >= 3,
      progressLabel: `${Math.min(streak, 3)}/3`,
    },
    {
      key: "unstoppable",
      icon: "award",
      title: "Unstoppable",
      description: "7-day applying streak",
      unlocked: streak >= 7,
      progressLabel: `${Math.min(streak, 7)}/7`,
    },
    {
      key: "marathon",
      icon: "calendar",
      title: "Marathon",
      description: "30-day applying streak",
      unlocked: streak >= 30,
      progressLabel: `${Math.min(streak, 30)}/30`,
    },
    {
      key: "globe_trotter",
      icon: "globe",
      title: "Globe Trotter",
      description: "Applied to companies in 3+ countries",
      unlocked: countryCount >= 3,
      progressLabel: `${Math.min(countryCount, 3)}/3`,
    },
  ];

  return { achievements, stats: { totalSent, bestDay, streak, countryCount } };
}
