// achievements.ts
// Badges and levels that reward people for helping their community, like
// SortClean's achievements. Everything is worked out from the person's own
// reports, so nothing extra needs to be saved.

import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import { IssueType } from '../constants/fmb';
import { Report } from './ReportsContext';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Numbers about what this person has done. Each badge tracks one of these.
export type Stats = {
  reports: number; // reports they made
  byType: Record<IssueType, number>; // reports per issue type
  typesCovered: number; // how many different issue types they've reported
  sent: number; // reports sent to the township (or already fixed)
  fixed: number; // their reports that got fixed
  upvotesGiven: number; // other people's reports they upvoted
};

export function getStats(reports: Report[]): Stats {
  const mine = reports.filter((r) => r.mine);
  const byType = { pothole: 0, sidewalk: 0, dumping: 0, graffiti: 0, tree: 0, none: 0 };
  for (const r of mine) byType[r.type]++;
  return {
    reports: mine.length,
    byType,
    typesCovered: (['pothole', 'sidewalk', 'dumping', 'graffiti', 'tree'] as const).filter((t) => byType[t] > 0).length,
    sent: mine.filter((r) => r.status !== 'open').length, // fixed ones were sent too
    fixed: mine.filter((r) => r.status === 'fixed').length,
    upvotesGiven: reports.filter((r) => !r.mine && r.voted).length,
  };
}

// Every badge: a name, what it's for, an icon, the goal, and which stat counts.
export type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  goal: number;
  stat: (s: Stats) => number;
};

export const ACHIEVEMENTS: Achievement[] = [
  // Reporting in general
  { id: 'first', title: 'First Report!', description: 'Report your first problem', icon: 'flag-outline', goal: 1, stat: (s) => s.reports },
  { id: 'watcher', title: 'Block Watcher', description: 'Report 5 problems', icon: 'eye-outline', goal: 5, stat: (s) => s.reports },
  { id: 'hero', title: 'Neighborhood Hero', description: 'Report 15 problems', icon: 'shield-checkmark-outline', goal: 15, stat: (s) => s.reports },
  { id: 'champion', title: 'Civic Champion', description: 'Report 40 problems', icon: 'trophy-outline', goal: 40, stat: (s) => s.reports },
  { id: 'legend', title: 'Town Legend', description: 'Report 100 problems', icon: 'star-outline', goal: 100, stat: (s) => s.reports },

  // Each issue type
  { id: 'pothole', title: 'Pothole Patrol', description: 'Report 5 potholes', icon: 'car-outline', goal: 5, stat: (s) => s.byType.pothole },
  { id: 'sidewalk', title: 'Sidewalk Inspector', description: 'Report 5 damaged sidewalks', icon: 'walk-outline', goal: 5, stat: (s) => s.byType.sidewalk },
  { id: 'dumping', title: 'Cleanup Crew', description: 'Report 5 illegal dumping spots', icon: 'trash-outline', goal: 5, stat: (s) => s.byType.dumping },
  { id: 'graffiti', title: 'Wall Watcher', description: 'Report 5 graffiti spots', icon: 'color-palette-outline', goal: 5, stat: (s) => s.byType.graffiti },
  { id: 'tree', title: 'Storm Spotter', description: 'Report 3 fallen trees', icon: 'leaf-outline', goal: 3, stat: (s) => s.byType.tree },
  { id: 'allrounder', title: 'All-Rounder', description: 'Report every type of problem at least once', icon: 'apps-outline', goal: 5, stat: (s) => s.typesCovered },

  // Getting problems to the township and fixed
  { id: 'voice', title: 'Voice Heard', description: 'Send a report to your township', icon: 'mail-outline', goal: 1, stat: (s) => s.sent },
  { id: 'townhall', title: 'Town Hall Regular', description: 'Send 10 reports to your township', icon: 'business-outline', goal: 10, stat: (s) => s.sent },
  { id: 'firstfix', title: 'First Fix!', description: 'Get one of your reports fixed', icon: 'construct-outline', goal: 1, stat: (s) => s.fixed },
  { id: 'change', title: 'Real Change', description: 'Get 10 of your reports fixed', icon: 'ribbon-outline', goal: 10, stat: (s) => s.fixed },

  // Helping neighbors
  { id: 'neighbor', title: 'Good Neighbor', description: "Upvote 5 of your neighbors' reports", icon: 'people-outline', goal: 5, stat: (s) => s.upvotesGiven },
];

// Points: reporting is good, getting it to the town is better, and getting it
// fixed is best.
export function getPoints(s: Stats) {
  return s.reports * 10 + s.sent * 5 + s.fixed * 20 + s.upvotesGiven * 2;
}

// Levels unlock as points add up.
export const LEVELS = [
  { name: 'Newcomer', points: 0 },
  { name: 'Block Watcher', points: 50 },
  { name: 'Neighborhood Helper', points: 150 },
  { name: 'Community Hero', points: 400 },
  { name: 'Civic Legend', points: 1000 },
];

// Which level someone is at, and how close they are to the next one.
export function getLevel(points: number) {
  let i = 0;
  while (i + 1 < LEVELS.length && points >= LEVELS[i + 1].points) i++;
  const next = LEVELS[i + 1];
  const progress = next ? (points - LEVELS[i].points) / (next.points - LEVELS[i].points) : 1;
  return { level: i + 1, name: LEVELS[i].name, next, progress };
}

// Badges that were just unlocked by a change, for example right after a new
// report. Compares the stats before and after.
export function newlyUnlocked(before: Report[], after: Report[]) {
  const a = getStats(before);
  const b = getStats(after);
  return ACHIEVEMENTS.filter((x) => x.stat(a) < x.goal && x.stat(b) >= x.goal);
}