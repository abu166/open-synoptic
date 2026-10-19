import { value, type Forecast, type City } from "../../types/telemetry.ts";
import { dateKey } from "../meteorology/time.ts";
export interface Plan {
  id: string;
  name: string;
  city: City;
  duration: number;
  startHour: number;
  endHour: number;
  days: number[];
  date: string;
  rain: number;
  gust: number;
  minTemp: number;
  maxTemp: number;
  daylight: boolean;
  preferredTemp: number;
  returnAfter: number;
  createdAt: number;
}
export interface Window {
  start: number;
  end: number;
  score: number;
  failures: string[];
  rain: number;
  gust: number;
  cold: number;
  hot: number;
  returnTime?: number;
  returnCold?: number;
}
export function defaultPlan(city: City): Plan {
  return {
    id: "",
    name: "My outdoor plan",
    city,
    duration: 1,
    startHour: 7,
    endHour: 20,
    days: [1, 2, 3, 4, 5, 6, 0],
    date: "",
    rain: 40,
    gust: 35,
    minTemp: -5,
    maxTemp: 30,
    daylight: true,
    preferredTemp: 18,
    returnAfter: 0,
    createdAt: Date.now(),
  };
}
export function validatePlan(p: unknown): p is Plan {
  if (!p || typeof p !== "object") return false;
  const x = p as Plan;
  return (
    typeof x.name === "string" &&
    x.name.length > 0 &&
    x.name.length <= 80 &&
    typeof x.id === "string" &&
    typeof x.date === "string" &&
    (!x.date ||
      (/^\d{4}-\d{2}-\d{2}$/.test(x.date) &&
        Number.isFinite(Date.parse(x.date)) &&
        new Date(x.date).toISOString().slice(0, 10) === x.date)) &&
    !!x.city &&
    typeof x.city.name === "string" &&
    typeof x.city.country === "string" &&
    Number.isFinite(x.city.latitude) &&
    Math.abs(x.city.latitude) <= 90 &&
    Number.isFinite(x.city.longitude) &&
    Math.abs(x.city.longitude) <= 180 &&
    validZone(x.city.timezone) &&
    Array.isArray(x.days) &&
    x.days.length > 0 &&
    x.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) &&
    [
      x.duration,
      x.startHour,
      x.endHour,
      x.rain,
      x.gust,
      x.minTemp,
      x.maxTemp,
      x.preferredTemp,
      x.returnAfter,
      x.createdAt,
    ].every(Number.isFinite) &&
    x.duration >= 0.5 &&
    x.duration <= 6 &&
    Number.isInteger(x.duration * 2) &&
    Number.isInteger(x.startHour) &&
    Number.isInteger(x.endHour) &&
    Number.isInteger(x.returnAfter) &&
    x.startHour >= 0 &&
    x.endHour <= 24 &&
    x.endHour - x.startHour >= x.duration &&
    x.rain >= 0 &&
    x.rain <= 100 &&
    x.gust >= 0 &&
    x.gust <= 150 &&
    x.minTemp >= -70 &&
    x.maxTemp <= 60 &&
    x.minTemp <= x.maxTemp &&
    x.preferredTemp >= -70 &&
    x.preferredTemp <= 60 &&
    (x.returnAfter === 0 || x.returnAfter >= x.duration) &&
    x.returnAfter >= 0 &&
    x.returnAfter <= 18 &&
    typeof x.daylight === "boolean"
  );
}
function validZone(zone: string) {
  if (typeof zone !== "string") return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
export function evaluatePlan(
  w: Forecast,
  p: Plan,
  now = Date.now(),
  horizonHours = 168,
) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: w.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const windows: Window[] = [];
  for (let i = 0; i < w.hourly.time.length; i++) {
    const start = Date.parse(w.hourly.time[i]),
      local = dateKey(new Date(start), w.timezone);
    const [hh, mm] = formatter.format(new Date(start)).split(":").map(Number);
    const hour = hh + mm / 60;
    const weekday = new Date(`${local}T12:00:00Z`).getUTCDay();
    if (
      start < now ||
      start >= now + horizonHours * 3600000 ||
      hour < p.startHour ||
      hour + p.duration > p.endHour ||
      !p.days.includes(weekday) ||
      (p.date && local !== p.date)
    )
      continue;
    const count = Math.ceil(p.duration),
      indexes = Array.from({ length: count }, (_, j) => i + j);
    const returnTime = p.returnAfter
      ? start + p.returnAfter * 3600000
      : undefined;
    const returnIndex =
      returnTime === undefined
        ? -1
        : w.hourly.time.findIndex((t) => Date.parse(t) === returnTime);
    if (returnTime !== undefined) {
      if (returnIndex < 0) continue;
      indexes.push(...Array.from({ length: count }, (_, j) => returnIndex + j));
    }
    if (
      indexes.some(
        (k, j) =>
          !w.hourly.time[k] ||
          (j > 0 &&
            j !== count &&
            Date.parse(w.hourly.time[k]) -
              Date.parse(w.hourly.time[indexes[j - 1]]) !==
              3600000),
      )
    )
      continue;
    const fields = [
      "precipitation_probability",
      "wind_gusts_10m",
      "apparent_temperature",
      ...(p.daylight ? ["is_day"] : []),
    ];
    const missing = indexes.some((k) =>
      fields.some((f) => !Number.isFinite(value(w.hourly, f, k))),
    );
    const rain = Math.max(
      ...indexes.map((k) => value(w.hourly, "precipitation_probability", k)),
    );
    const gust = Math.max(
      ...indexes.map((k) => value(w.hourly, "wind_gusts_10m", k)),
    );
    const temps = indexes.map((k) =>
      value(w.hourly, "apparent_temperature", k),
    );
    const cold = Math.min(...temps),
      hot = Math.max(...temps),
      failures: string[] = [];
    if (missing) failures.push("Missing weather data");
    if (rain > p.rain) failures.push("Rain limit");
    if (gust > p.gust) failures.push("Gust limit");
    if (cold < p.minTemp) failures.push("Too cold");
    if (hot > p.maxTemp) failures.push("Too warm");
    if (p.daylight && indexes.some((k) => value(w.hourly, "is_day", k) !== 1))
      failures.push("Daylight required");
    const score = missing
      ? 0
      : Math.max(
          0,
          100 -
            Math.abs((cold + hot) / 2 - p.preferredTemp) * 2 -
            rain * 0.3 -
            gust * 0.4,
        );
    windows.push({
      start,
      end: start + p.duration * 3600000,
      score,
      failures,
      rain,
      gust,
      cold,
      hot,
      returnTime,
      returnCold:
        returnIndex < 0
          ? undefined
          : Math.min(
              ...Array.from({ length: count }, (_, j) =>
                value(w.hourly, "apparent_temperature", returnIndex + j),
              ),
            ),
    });
  }
  const qualifying = windows
    .filter((x) => !x.failures.length)
    .sort(
      (a, b) =>
        dateKey(new Date(a.start), w.timezone).localeCompare(
          dateKey(new Date(b.start), w.timezone),
        ) ||
        b.score - a.score ||
        a.start - b.start,
    );
  const best = qualifying[0];
  const backup = qualifying.find(
    (x) => best && (x.start >= best.end || x.end <= best.start),
  );
  const closest = [...windows].sort(
    (a, b) =>
      a.failures.length - b.failures.length ||
      b.score - a.score ||
      a.start - b.start,
  )[0];
  return { best, backup, closest, windows };
}
export function planLink(p: Plan, base: string) {
  const url = new URL(base);
  url.search = "";
  url.hash = "";
  url.searchParams.set("view", "intelligence");
  url.searchParams.set("lat", String(p.city.latitude));
  url.searchParams.set("lon", String(p.city.longitude));
  url.searchParams.set("city", p.city.name);
  url.searchParams.set("plan", JSON.stringify({ ...p, id: "", createdAt: 0 }));
  return url.toString();
}
export function importPlan(search: string): Plan | undefined {
  try {
    const raw = new URLSearchParams(search).get("plan");
    if (!raw || raw.length > 4000) return;
    const p: unknown = JSON.parse(raw);
    return validatePlan(p) ? p : undefined;
  } catch {
    return;
  }
}
export function calendarEvent(
  title: string,
  start: number,
  end: number,
  description: string,
  uid: string,
) {
  const escape = (s: string) =>
    s
      .replace(/\\/g, "\\\\")
      .replace(/\r\n|\r|\n/g, "\\n")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,");
  const stamp = (t: number) =>
    new Date(t)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Aetheris//Plans//EN",
    "BEGIN:VEVENT",
    `UID:${escape(uid)}@aetheris`,
    `DTSTAMP:${stamp(Date.now())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(title)}`,
    `DESCRIPTION:${escape(description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  // RFC 5545 folds content lines at 75 UTF-8 octets, including continuation space.
  return (
    lines
      .map((line) => {
        let result = "",
          part = "";
        for (const c of line) {
          if (new TextEncoder().encode(part + c).length > 75) {
            result += part + "\r\n";
            part = " ";
          }
          part += c;
        }
        return result + part;
      })
      .join("\r\n") + "\r\n"
  );
}
export function downloadFile(
  name: string,
  text: string,
  type = "text/calendar",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
