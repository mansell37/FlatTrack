/**
 * Landmark climbs: simplified real-world elevation profiles + the physics that
 * turns your live trainer power into virtual speed up the mountain.
 *
 * Profiles are encoded as consecutive segments of {km, g} (length in km, average
 * gradient %). They're good-faith approximations of the documented km-by-km
 * gradients — close enough for benchmarking your own times against yourself.
 */

export interface Segment {
  km: number; // segment length, km
  g: number;  // average gradient, %
}

export interface Climb {
  key: string;
  name: string;
  where: string;
  flag: string;
  blurb: string;
  segments: Segment[];
}

export const CLIMBS: Climb[] = [
  {
    key: "climb_boxhill",
    name: "Box Hill",
    where: "Surrey, England",
    flag: "🇬🇧",
    blurb: "The London 2012 climb. Short and friendly — a perfect first summit (~10 min).",
    segments: [
      { km: 0.6, g: 4.5 }, { km: 0.6, g: 6.0 }, { km: 0.7, g: 5.5 }, { km: 0.6, g: 3.5 },
    ],
  },
  {
    key: "climb_alpedhuez",
    name: "Alpe d'Huez",
    where: "French Alps",
    flag: "🇫🇷",
    blurb: "21 hairpins of Tour legend. Steepest at the bottom — pace the opening ramps.",
    segments: [
      { km: 1, g: 10.4 }, { km: 1, g: 7.9 }, { km: 1, g: 9.5 }, { km: 1, g: 8.4 },
      { km: 1, g: 7.8 }, { km: 1, g: 8.2 }, { km: 1, g: 8.2 }, { km: 1, g: 7.5 },
      { km: 1, g: 8.1 }, { km: 1, g: 7.7 }, { km: 1, g: 8.7 }, { km: 1, g: 7.3 },
      { km: 1, g: 8.2 }, { km: 0.8, g: 5.5 },
    ],
  },
  {
    key: "climb_tourmalet",
    name: "Col du Tourmalet",
    where: "Pyrenees, France",
    flag: "🇫🇷",
    blurb: "The Pyrenean giant — long, relentless, and steepest near the summit.",
    segments: [
      { km: 1, g: 4.0 }, { km: 1, g: 5.5 }, { km: 1, g: 7.5 }, { km: 1, g: 6.5 },
      { km: 1, g: 8.0 }, { km: 1, g: 8.5 }, { km: 1, g: 7.5 }, { km: 1, g: 8.5 },
      { km: 1, g: 9.0 }, { km: 1, g: 8.0 }, { km: 1, g: 8.5 }, { km: 1, g: 9.5 },
      { km: 1, g: 8.5 }, { km: 1, g: 9.0 }, { km: 1, g: 9.5 }, { km: 1, g: 10.0 },
      { km: 1.1, g: 10.0 },
    ],
  },
  {
    key: "climb_ventoux",
    name: "Mont Ventoux",
    where: "Provence, France (from Bédoin)",
    flag: "🇫🇷",
    blurb: "The Giant of Provence. Brutal through the forest, lunar and windswept at the top.",
    segments: [
      { km: 1, g: 3.9 }, { km: 1, g: 5.0 }, { km: 1, g: 4.5 }, { km: 1, g: 4.0 },
      { km: 1, g: 3.5 }, { km: 1, g: 5.5 }, { km: 1, g: 8.5 }, { km: 1, g: 9.5 },
      { km: 1, g: 10.0 }, { km: 1, g: 9.5 }, { km: 1, g: 9.0 }, { km: 1, g: 9.5 },
      { km: 1, g: 8.5 }, { km: 1, g: 9.0 }, { km: 1, g: 8.5 }, { km: 1, g: 7.5 },
      { km: 1, g: 8.0 }, { km: 1, g: 7.0 }, { km: 1, g: 7.5 }, { km: 1, g: 6.5 },
      { km: 1, g: 9.0 }, { km: 0.5, g: 9.5 },
    ],
  },
  {
    key: "climb_stelvio",
    name: "Passo dello Stelvio",
    where: "Italian Alps (from Prato)",
    flag: "🇮🇹",
    blurb: "48 hairpins, the highest of the lot. A monument — bring snacks.",
    segments: [
      { km: 1, g: 5.0 }, { km: 1, g: 6.0 }, { km: 1, g: 6.5 }, { km: 1, g: 7.0 },
      { km: 1, g: 7.5 }, { km: 1, g: 7.0 }, { km: 1, g: 7.5 }, { km: 1, g: 8.0 },
      { km: 1, g: 7.5 }, { km: 1, g: 7.0 }, { km: 1, g: 7.5 }, { km: 1, g: 8.0 },
      { km: 1, g: 8.5 }, { km: 1, g: 8.0 }, { km: 1, g: 7.5 }, { km: 1, g: 8.0 },
      { km: 1, g: 8.5 }, { km: 1, g: 9.0 }, { km: 1, g: 8.5 }, { km: 1, g: 8.0 },
      { km: 1, g: 7.5 }, { km: 1, g: 8.0 }, { km: 1, g: 9.0 }, { km: 1.3, g: 8.0 },
    ],
  },
];

export function climbLengthM(c: Climb): number {
  return c.segments.reduce((a, s) => a + s.km * 1000, 0);
}

export function climbElevationM(c: Climb): number {
  return Math.round(c.segments.reduce((a, s) => a + s.km * 1000 * (s.g / 100), 0));
}

export function climbAvgGrade(c: Climb): number {
  return Math.round((climbElevationM(c) / climbLengthM(c)) * 1000) / 10;
}

/** Gradient (%) at a given distance along the climb. */
export function gradeAt(c: Climb, meters: number): number {
  let d = meters;
  for (const s of c.segments) {
    const len = s.km * 1000;
    if (d < len) return s.g;
    d -= len;
  }
  return c.segments[c.segments.length - 1]?.g ?? 0;
}

// Physics constants for the climb simulation.
const G = 9.81;
const CRR = 0.0045;      // rolling resistance (road tyre on tarmac)
const CDA = 0.34;        // frontal area × drag coeff, climbing on the hoods
const RHO = 1.06;        // air density at altitude-ish
const BIKE_KG = 9;       // bike + kit
const DRIVETRAIN = 0.975; // drivetrain efficiency

/**
 * Speed (m/s) sustained at `watts` on `gradePct` for a rider of `riderKg`.
 * Solves P = a·v + b·v³ (gravity+rolling, plus aero) with Newton's method.
 */
export function speedFromPower(watts: number, gradePct: number, riderKg: number): number {
  const p = Math.max(0, watts) * DRIVETRAIN;
  if (p <= 0) return 0;
  const m = riderKg + BIKE_KG;
  const theta = Math.atan(gradePct / 100);
  const a = m * G * (CRR * Math.cos(theta) + Math.sin(theta));
  const b = 0.5 * RHO * CDA;
  let v = 3;
  for (let i = 0; i < 25; i++) {
    const f = a * v + b * v * v * v - p;
    const fp = a + 3 * b * v * v;
    const next = v - f / fp;
    if (!isFinite(next) || next <= 0) { v = v / 2; continue; }
    if (Math.abs(next - v) < 1e-4) return next;
    v = next;
  }
  return Math.max(0, v);
}
