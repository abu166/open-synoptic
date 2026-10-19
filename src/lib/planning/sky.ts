import {
  lunarPhase,
  lunarPosition,
  solarPosition,
} from "../meteorology/ephemeris.ts";
import { dateKey, zonedMidnight } from "../meteorology/time.ts";
export interface SkyWindow {
  start: number;
  end: number;
  kind:
    | "Morning golden hour"
    | "Evening golden hour"
    | "Morning blue hour"
    | "Evening blue hour"
    | "Dark sky";
  clipped: boolean;
}
export function localDayEnd(start: Date, timezone: string) {
  return zonedMidnight(new Date(+start + 36 * 3600000), timezone);
}
export function lightWindows(
  date: Date,
  lat: number,
  lon: number,
  timezone: string,
): SkyWindow[] {
  const start = +zonedMidnight(date, timezone),
    end = +localDayEnd(new Date(start), timezone);
  const elevation = (t: number) =>
    solarPosition(new Date(t), lat, lon).elevation;
  const out: SkyWindow[] = [];
  for (const [low, high, kind] of [
    [-4, 6, "golden"],
    [-6, -4, "blue"],
    [-90, -18, "dark"],
  ] as const) {
    let opened: number | undefined;
    const inside = (t: number) => elevation(t) >= low && elevation(t) <= high;
    let previous = inside(start);
    if (previous) opened = start;
    for (let t = start + 300000; t <= end + 300000; t += 300000) {
      const right = Math.min(t, end),
        next = inside(right);
      if (next !== previous) {
        let a = right - 300000,
          b = right;
        for (let j = 0; j < 18; j++) {
          const mid = (a + b) / 2;
          if (inside(mid) === previous) a = mid;
          else b = mid;
        }
        const edge = (a + b) / 2;
        if (next) opened = edge;
        else if (opened !== undefined) {
          push(opened, edge);
          opened = undefined;
        }
      }
      previous = next;
      if (right === end) break;
    }
    if (opened !== undefined) push(opened, end);
    function push(a: number, b: number) {
      const rising =
        elevation((a + b) / 2 + 60000) > elevation((a + b) / 2 - 60000);
      const label =
        kind === "dark"
          ? "Dark sky"
          : kind === "golden"
            ? rising
              ? "Morning golden hour"
              : "Evening golden hour"
            : rising
              ? "Morning blue hour"
              : "Evening blue hour";
      out.push({
        start: a,
        end: b,
        kind: label,
        clipped: a === start || b === end,
      });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}
export function nextMoonPhase(date: Date, target: number) {
  // Solve the elongation crossing rather than assuming a constant synodic speed.
  const signed = (t: number) =>
    ((lunarPhase(new Date(t)).angle - target + 540) % 360) - 180;
  let a = +date,
    prev = signed(a);
  for (let b = a + 6 * 3600000; b <= +date + 35 * 86400000; b += 6 * 3600000) {
    const current = signed(b);
    if (prev <= 0 && current >= 0 && current - prev < 180) {
      let left = b - 6 * 3600000,
        right = b;
      for (let j = 0; j < 30; j++) {
        const mid = (left + right) / 2;
        if (signed(mid) < 0) left = mid;
        else right = mid;
      }
      return (left + right) / 2;
    }
    a = b;
    prev = current;
  }
  return undefined;
}
export function moonCrossings(
  date: Date,
  lat: number,
  lon: number,
  timezone: string,
) {
  const start = +zonedMidnight(date, timezone),
    end = +localDayEnd(new Date(start), timezone);
  const elevation = (t: number) =>
    lunarPosition(new Date(t), lat, lon).elevation;
  const events: { time: number; kind: "Moonrise" | "Moonset" }[] = [];
  let prev = elevation(start);
  for (let t = start + 300000; t <= end; t += 300000) {
    const current = elevation(t);
    if (current * prev < 0) {
      let a = t - 300000,
        b = t;
      for (let j = 0; j < 18; j++) {
        const mid = (a + b) / 2;
        if (elevation(mid) * prev > 0) a = mid;
        else b = mid;
      }
      events.push({
        time: (a + b) / 2,
        kind: current > prev ? "Moonrise" : "Moonset",
      });
    }
    prev = current;
  }
  return { events, aboveAtMidnight: elevation(start) > 0 };
}
export function phaseName(angle: number) {
  return [
    "New moon",
    "Waxing crescent",
    "First quarter",
    "Waxing gibbous",
    "Full moon",
    "Waning gibbous",
    "Last quarter",
    "Waning crescent",
  ][Math.round(angle / 45) % 8];
}
export function skyDayKey(date: Date, zone: string) {
  return dateKey(date, zone);
}
