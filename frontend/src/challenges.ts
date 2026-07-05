import type { Workout } from "./types";

export type BenchKind = "ramp" | "ftp20" | "kb";

export interface Benchmark {
  key: string;
  kind: BenchKind;
  emoji: string;
  title: string;
  blurb: string;
  unit: "W" | "rounds";
  needsTrainer: boolean;
}

export const BENCHMARKS: Benchmark[] = [
  {
    key: "ftp_ramp",
    kind: "ramp",
    emoji: "📈",
    title: "FTP Ramp Test",
    blurb: "The trainer adds 20W every minute until you crack — just hold a steady cadence "
      + "and press Finish when you can't turn the pedals. FTP = 75% of your best minute. ~15–25 min.",
    unit: "W",
    needsTrainer: true,
  },
  {
    key: "ftp_20",
    kind: "ftp20",
    emoji: "⏱️",
    title: "20-Minute FTP Test",
    blurb: "The classic: warm up, then 20 minutes all-out at your own pace. FTP = 95% of your "
      + "average power. ERG stays OFF — shift gears like you're outdoors.",
    unit: "W",
    needsTrainer: true,
  },
  {
    key: "kb_bells",
    kind: "kb",
    emoji: "🔔",
    title: "The Bell Ringer",
    blurb: "Fixed 10-minute kettlebell AMRAP: 10 swings, 8 goblet squats, 6 push presses. "
      + "Same test every time — your score is total rounds. Beat your last one.",
    unit: "rounds",
    needsTrainer: false,
  },
];

/** ERG steps: warm-up then +20W each minute from ~46% FTP until far beyond failure. */
export function buildRampTest(ftp: number): Workout {
  const start = Math.max(80, Math.round((ftp * 0.46) / 10) * 10);
  const blocks: Workout["blocks"] = [
    {
      label: "Warm-up", seconds: 300, kind: "warmup",
      watts: Math.round(ftp * 0.5), power_pct: 50,
      notes: "Easy spin. The ramp starts next — ride until you physically can't, then press Finish.",
    },
  ];
  for (let i = 0; i < 30; i++) {
    const w = start + i * 20;
    blocks.push({
      label: `Step ${i + 1} — ${w}W`, seconds: 60, kind: "work",
      watts: w, power_pct: Math.round((w / ftp) * 100),
      notes: "Steady cadence (85–95rpm). When you blow, press Finish — that's the test working.",
    });
  }
  return {
    type: "cardio", title: "FTP Ramp Test", format: "RAMP", duration_min: 25,
    energy: "fresh", source: "template", timer: "interval",
    summary: "ERG adds 20W per minute. Ride to failure, then press Finish. FTP = 75% of your best 1-minute power.",
    blocks,
  };
}

/** Warm-up + 20-min free effort (no ERG) + cool-down. mainBlockIndex = the test block. */
export const FTP20_MAIN_BLOCK = 4;
export function buildFtp20Test(ftp: number): Workout {
  return {
    type: "cardio", title: "20-Minute FTP Test", format: "FTP TEST", duration_min: 38,
    energy: "fresh", source: "template", timer: "interval",
    summary: "Warm up, then 20 minutes at the hardest pace you can hold. ERG is off — shift gears "
      + "to control effort. FTP = 95% of your 20-min average power.",
    blocks: [
      { label: "Warm-up", seconds: 300, kind: "warmup", watts: null, power_pct: null,
        notes: "Easy spin, build gradually. ERG is off for this whole test — use your gears." },
      { label: "Opener 1", seconds: 60, kind: "work", watts: null, power_pct: null,
        notes: "1 minute hard to wake the legs up." },
      { label: "Easy", seconds: 120, kind: "rest", watts: null, power_pct: null,
        notes: "Fully recover." },
      { label: "Opener 2", seconds: 60, kind: "work", watts: null, power_pct: null,
        notes: "One more hard minute, then settle." },
      { label: "Recover before the test", seconds: 180, kind: "rest", watts: null, power_pct: null,
        notes: "Deep breaths. The 20 minutes starts next — start strong but sustainable." },
      { label: "20-MIN TEST — ALL OUT", seconds: 1200, kind: "work", watts: null, power_pct: null,
        notes: "The hardest pace you can hold for 20 minutes. Even effort beats a fast start." },
      { label: "Cool-down", seconds: 300, kind: "cooldown", watts: null, power_pct: null,
        notes: "Spin it out. Great work." },
    ],
  };
}
// index of the 20-min block in buildFtp20Test().blocks
export const FTP20_TEST_BLOCK_INDEX = 5;

/** Fixed KB benchmark — identical every time so scores are comparable. */
export function buildBellRinger(): Workout {
  return {
    type: "strength", title: "The Bell Ringer", format: "AMRAP", duration_min: 10,
    energy: "fresh", source: "template", timer: "amrap",
    summary: "10-minute AMRAP benchmark. Count full rounds — same test every time, so your score "
      + "tracks your fitness. Pace it: smooth is fast.",
    blocks: [
      { label: "Kettlebell Swing", reps: "10", seconds: null, kind: "work",
        notes: "Explosive hips, float to chest height." },
      { label: "Goblet Squat", reps: "8", seconds: null, kind: "work",
        notes: "KB at chest, sit deep, drive through heels." },
      { label: "Push Press", reps: "6", seconds: null, kind: "work",
        notes: "3 per side. Dip the knees, drive overhead." },
    ],
  };
}
