import test from "node:test";
import assert from "node:assert/strict";
import { forecast } from "./fixtures.mjs";
import {
  defaultPlan,
  evaluatePlan,
  validatePlan,
  calendarEvent,
  planLink,
  importPlan,
} from "../src/lib/planning/plans.ts";
import {
  snapshot,
  changes,
  updateHistory,
  verificationStats,
} from "../src/lib/planning/history.ts";
import {
  lightWindows,
  nextMoonPhase,
  moonCrossings,
  localDayEnd,
} from "../src/lib/planning/sky.ts";
import { lunarPhase, solarPosition } from "../src/lib/meteorology/ephemeris.ts";
import { zonedMidnight } from "../src/lib/meteorology/time.ts";
import { memberSummary, fetchVerification } from "../src/api/planningClient.ts";
import { parseEnsemble } from "../src/api/resilience.ts";
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: { getItem: () => null, setItem: () => {} },
});
const city = {
  name: "Astana",
  country: "Kazakhstan",
  latitude: 51,
  longitude: 71,
  timezone: "Asia/Almaty",
};
function setup() {
  const w = forecast();
  w.hourly.temperature_2m.fill(15);
  w.hourly.apparent_temperature.fill(15);
  w.hourly.precipitation_probability = w.hourly.time.map(() => 10);
  w.hourly.is_day.fill(1);
  return {
    w,
    p: { ...defaultPlan(city), startHour: 0, endHour: 24 },
    now: w.current.time * 1000,
  };
}
test("all hours and return journey satisfy hard limits; preferences never override violations", () => {
  const { w, p, now } = setup();
  p.duration = 2;
  p.returnAfter = 8;
  w.hourly.wind_gusts_10m.fill(60);
  w.hourly.wind_gusts_10m[0] = 10;
  assert.equal(evaluatePlan(w, p, now).best, undefined);
  w.hourly.wind_gusts_10m.fill(10);
  w.hourly.apparent_temperature[8] = -20;
  assert.ok(
    evaluatePlan(w, p, now)
      .windows.find((x) => x.start === now)
      .failures.includes("Too cold"),
  );
  const r = evaluatePlan(w, p, now);
  assert.ok(r.best);
  assert.ok(!r.best.failures.length);
  assert.ok(r.backup.start >= r.best.end || r.backup.end <= r.best.start);
});
test("missing samples, gaps and dates outside horizon never yield a qualifying window", () => {
  const { w, p, now } = setup();
  w.hourly.precipitation_probability.fill(null);
  assert.equal(evaluatePlan(w, p, now).best, undefined);
  p.date = "2030-01-01";
  assert.equal(evaluatePlan(w, p, now).windows.length, 0);
  p.date = "";
  p.duration = 2;
  w.hourly.time = [w.hourly.time[0], w.hourly.time[2]];
  assert.equal(evaluatePlan(w, p, now).windows.length, 0);
});
test("recurrence uses the location weekday, not UTC or browser time", () => {
  const { w, p } = setup();
  w.timezone = "Asia/Tokyo";
  w.hourly.time = ["2026-10-18T23:00:00Z"];
  p.days = [1];
  p.startHour = 8;
  p.endHour = 9;
  assert.ok(evaluatePlan(w, p, Date.parse("2026-10-18T22:00:00Z")).best);
  p.days = [0];
  assert.equal(evaluatePlan(w, p, 0).windows.length, 0);
});
test("shared plans round-trip unicode and reject malformed, oversized and invalid plans", () => {
  const p = { ...defaultPlan(city), name: "Серуен 🌙" };
  assert.ok(validatePlan(p));
  const url = new URL(
    planLink(p, "https://example.com/open-synoptic/?other=yes#x"),
  );
  assert.equal(importPlan(url.search).name, p.name);
  for (const patch of [
    { days: [] },
    { city: { ...city, latitude: 95 } },
    { duration: -1 },
    { minTemp: 40, maxTemp: 20 },
    { endHour: 2, startHour: 7 },
    { daylight: "yes" },
    { city: { ...city, timezone: "bad/zone" } },
  ])
    assert.equal(validatePlan({ ...p, ...patch }), false);
  assert.equal(importPlan("?plan=%7Bbad"), undefined);
});
test("calendar escapes injection, uses UTC and folds unicode at 75 octets", () => {
  const ics = calendarEvent(
    "Full moon, 🌕".repeat(20),
    0,
    3600000,
    "test\nBEGIN:VEVENT; hi",
    "a",
  );
  for (const line of ics.split("\r\n"))
    assert.ok(Buffer.byteLength(line) <= 75);
  assert.match(ics, /DTSTART:19700101T000000Z/);
  assert.match(ics, /\\nBEGIN:VEVENT\\;/);
  assert.equal((ics.match(/\r\nBEGIN:VEVENT\r\n/g) || []).length, 1);
});
test("forecast changes align valid time and cooldown suppresses duplicate alerts", () => {
  const { w, now } = setup();
  const old = snapshot(w, now);
  w.hourly.precipitation_probability[2] = 70;
  const next = snapshot(w, now + 600000);
  assert.equal(
    changes(old, next).find((c) => c.field === "rain").time,
    Date.parse(w.hourly.time[2]),
  );
  const first = updateHistory([old], next, []);
  assert.equal(first.feed.length, 1);
  w.hourly.precipitation_probability[2] = 10;
  const recovery = snapshot(w, now + 1200000);
  assert.equal(
    updateHistory(first.history, recovery, first.feed).feed.length,
    1,
  );
  assert.equal(
    updateHistory(first.history, next, first.feed).history.length,
    2,
  );
});
test("verification excludes missing pairs and reports signed bias", () => {
  assert.deepEqual(verificationStats([10, null, 14, NaN], [8, 11, 10, 9]), {
    n: 2,
    mae: 3,
    bias: 3,
  });
  assert.deepEqual(verificationStats([], []), { n: 0, mae: null, bias: null });
});
test("real member summaries exclude missing data and invented scenario fields", () => {
  const data = {
    hourly: {
      time: [1000],
      precipitation: [0],
      precipitation_member01: [1],
      precipitation_member02: [null],
      precipitation_scenario: [100],
      temperature_2m: [5],
      wind_gusts_10m: [40],
    },
  };
  const m = memberSummary(data, 1000000, 35);
  assert.equal(m.rainN, 2);
  assert.equal(m.wet, 0.5);
  assert.equal(m.gust, 1);
  assert.equal(memberSummary(data, 0, 35).wet, null);
});
test("model provenance tracks real and generated values independently", () => {
  const { w } = setup();
  const e = parseEnsemble(
    {
      hourly: {
        time: w.hourly.time,
        temperature_2m_ecmwf_ifs025: w.hourly.time.map((_, i) =>
          i === 1 ? null : 10,
        ),
      },
    },
    w,
  );
  assert.equal(e.sampleSources.temperature_2m_ecmwf_ifs04[0], "model");
  assert.equal(e.sampleSources.temperature_2m_ecmwf_ifs04[1], "estimated");
});
test("golden and blue windows bracket their altitude thresholds and polar night is explicit", () => {
  const d = new Date("2026-10-19T12:00:00Z");
  const windows = lightWindows(d, 51, 71, "Asia/Almaty");
  assert.equal(windows.filter((w) => w.kind.includes("golden")).length, 2);
  for (const w of windows) {
    const sun = solarPosition(
      new Date((w.start + w.end) / 2),
      51,
      71,
    ).elevation;
    if (w.kind.includes("golden")) assert.ok(sun >= -4 && sun <= 6);
    if (w.kind.includes("blue")) assert.ok(sun >= -6 && sun <= -4);
  }
  const polar = lightWindows(new Date("2026-06-21T12:00:00Z"), 89, 0, "UTC");
  assert.equal(polar.length, 0);
  const winter = lightWindows(new Date("2026-12-21T12:00:00Z"), 89, 0, "UTC");
  assert.ok(winter.some((w) => w.kind === "Dark sky" && w.clipped));
});
test("sky windows honor 23 and 25 hour local days", () => {
  for (const [day, hours] of [
    ["2026-03-08", 23],
    ["2026-11-01", 25],
  ]) {
    const d = new Date(`${day}T12:00:00Z`),
      start = zonedMidnight(d, "America/New_York"),
      end = localDayEnd(start, "America/New_York");
    assert.equal((end - start) / 3600000, hours);
    for (const w of lightWindows(d, 40, -74, "America/New_York"))
      assert.ok(w.start >= +start && w.end <= +end);
  }
});
test("next full moon solves elongation and moon crossings are local-day bounded", () => {
  const date = new Date("2026-10-19T12:00:00Z"),
    full = nextMoonPhase(date, 180);
  assert.ok(full > +date && full < +date + 35 * 86400000);
  assert.ok(Math.abs(lunarPhase(new Date(full)).angle - 180) < 0.001);
  const start = +zonedMidnight(date, city.timezone),
    end = +localDayEnd(new Date(start), city.timezone);
  for (const e of moonCrossings(date, 51, 71, city.timezone).events)
    assert.ok(e.time >= start && e.time < end);
});
test("archive verification aligns API model suffixes and valid times", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const archive = String(url).includes("archive-api");
    return new Response(
      JSON.stringify({
        hourly: archive
          ? {
              time: [1, 2],
              temperature_2m: [8, 12],
              wind_speed_10m: [10, 10],
              precipitation: [0, 1],
            }
          : {
              time: [2, 1],
              temperature_2m_previous_day1_ecmwf_ifs025: [14, 10],
            },
      }),
      { status: 200 },
    );
  };
  try {
    const result = await fetchVerification({ ...city, latitude: 50.12345 });
    const row = result.rows.find(
      (r) =>
        r.model === "ecmwf_ifs025" &&
        r.lead === 1 &&
        r.variable === "temperature_2m",
    );
    assert.equal(row.n, 2);
    assert.equal(row.mae, 2);
    assert.equal(row.bias, 2);
  } finally {
    globalThis.fetch = original;
  }
});
test("daily briefing stays within 24h and nearest qualifying day outranks distant comfort", () => {
  const { w, p, now } = setup();
  w.hourly.apparent_temperature[30] = 18;
  assert.ok(evaluatePlan(w, p, now).best.start < now + 24 * 3600000);
  assert.ok(
    evaluatePlan(w, p, now, 24).windows.every(
      (x) => x.start < now + 24 * 3600000,
    ),
  );
});
test("fractional time zones do not allow a journey to finish beyond the local limit", () => {
  const { w, p, now } = setup();
  w.timezone = "Asia/Kolkata";
  p.startHour = 11;
  p.endHour = 12;
  // 06:00 UTC is 11:30 local. A one-hour trip finishes at 12:30.
  assert.ok(!evaluatePlan(w, p, now).windows.some((x) => x.start === now));
});
test("invalid calendar dates, overlapping return trips and fractional departure hours are rejected", () => {
  const { p } = setup();
  for (const patch of [
    { date: "2026-02-30" },
    { duration: 2, returnAfter: 1 },
    { startHour: 7.5 },
    { preferredTemp: 100 },
  ])
    assert.equal(validatePlan({ ...p, ...patch }), false);
});
