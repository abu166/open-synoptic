import { weatherStory } from "../src/lib/meteorology/humanWeather.ts";
import test from "node:test";
import assert from "node:assert/strict";
import {
  selectedWeather,
  selectedAir,
} from "../src/experience/forecastMoment.ts";
import {
  activityBreakdown,
  scores,
} from "../src/lib/meteorology/activityScorer.ts";
import { forecast } from "./fixtures.mjs";
test("time travel interpolates continuous values, preserves discrete day/night, and leaves live data intact", () => {
  const w = forecast(),
    before = structuredClone(w),
    preview = selectedWeather(w, 8.5);
  assert.equal(preview.current.temperature_2m, 18.5);
  assert.equal(preview.current.is_day, 0);
  assert.equal(preview.current.time, w.current.time + 30600);
  assert.deepEqual(w, before);
  assert.equal(preview.hourly, w.hourly);
  assert.equal(selectedWeather(w, 0), w);
});
test("missing forecast readings do not silently become live rain values", () => {
  const w = forecast();
  w.current.precipitation = 2;
  w.hourly.precipitation = w.hourly.time.map(() => null);
  assert.ok(Number.isNaN(selectedWeather(w, 4).current.precipitation));
});
test("air-quality time travel uses UTC timestamps and preserves metadata", () => {
  const w = forecast(),
    a = {
      current: { time: w.current.time, interval: 3600, us_aqi: 30 },
      hourly: {
        time: w.hourly.time,
        us_aqi: w.hourly.time.map((_, i) => 30 + i),
      },
    };
  const p = selectedAir(a, (w.current.time + 7200) * 1000);
  assert.equal(p.current.us_aqi, 32);
  assert.equal(p.current.interval, 3600);
  assert.equal(a.current.us_aqi, 30);
});
test("visible activity penalties exactly reconcile with the scoring engine", () => {
  const w = forecast(),
    analyses = activityBreakdown(w, 0, 40, 0.4, 0.1),
    result = scores(w, 0, 40, 0.4, 0.1);
  analyses.forEach((a, i) => {
    assert.equal(a.raw, 100 - a.factors.reduce((sum, f) => sum + f.points, 0));
    assert.equal(a.score, Math.max(0, Math.min(100, Math.round(a.raw))));
    assert.equal(result[i], a.score);
  });
});
test("stargazing explicitly identifies daylight as the blocking factor", () => {
  const analysis = activityBreakdown(forecast(), 0, 30, 0.3, 0.1)[2];
  assert.equal(
    analysis.factors.find((f) => f.label === "Daylight interference").points,
    100,
  );
  assert.equal(analysis.score, 0);
});

test("rain showers and snow showers tell different human weather stories", () => {
  const w = forecast();
  w.current.weather_code = 80;
  w.current.snowfall = 0;
  w.current.precipitation = 0;
  assert.equal(weatherStory(w, "Test city").vibe, "RAIN-SOAKED");
  w.current.weather_code = 85;
  assert.equal(weatherStory(w, "Test city").vibe, "SNOW GLOBE");
});
