import test from "node:test";
import assert from "node:assert/strict";
import { forecast } from "./fixtures.mjs";
import {
  fetchCityBatch,
  fetchClimate,
  request,
} from "../src/api/openMeteoClient.ts";
import {
  parseEnsemble,
  MODEL_IDS,
  initialCityTelemetry,
  parseCityBatch,
  approximateClimate,
} from "../src/api/resilience.ts";
import { commuteOutfit } from "../src/lib/meteorology/commute.ts";
import { bicubic } from "../src/lib/meteorology/vectorField.ts";
import { skyAesthetics } from "../src/lib/meteorology/skyAesthetics.ts";
const city = {
  name: "Test",
  latitude: 51,
  longitude: 71,
  timezone: "Asia/Almaty",
  country: "Kazakhstan",
};
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
function rawCity(c, t) {
  return {
    latitude: c.latitude,
    longitude: c.longitude,
    timezone: c.timezone,
    current: {
      time: Math.floor(Date.now() / 900000) * 900,
      temperature_2m: t,
      weather_code: 3,
      cloud_cover: 80,
      is_day: 1,
    },
    hourly: {
      time: [1792216800, 1792220400],
      temperature_2m: [t, t + 1],
      weather_code: [3, 2],
      cloud_cover: [80, 50],
    },
  };
}
test("five saved cities use one batched HTTP request and preserve coordinate association", async (t) => {
  const cities = Array.from({ length: 5 }, (_, i) => ({
    ...city,
    name: `City ${i}`,
    latitude: 51 + i / 100,
    longitude: 71 + i / 100,
  }));
  let calls = 0,
    url;
  t.mock.method(globalThis, "fetch", async (input) => {
    calls++;
    url = new URL(input);
    return new Response(
      JSON.stringify(cities.map((c, i) => rawCity(c, 5 + i))),
      { status: 200 },
    );
  });
  const rows = await fetchCityBatch(cities);
  assert.equal(calls, 1);
  assert.equal(url.searchParams.get("latitude").split(",").length, 5);
  assert.deepEqual(
    rows.map((r) => r.temperature),
    [5, 6, 7, 8, 9],
  );
  assert.equal(rows[3].city.name, "City 3");
  assert.equal(rows[3].source, "live");
  const saved = initialCityTelemetry(cities[3]);
  assert.equal(saved.temperature, 8);
  assert.equal(saved.source, "cached");
});
test("concurrent identical requests share one network flight", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return new Response('{"value":42}');
  });
  const url = "https://example.com/v4-flight";
  const [a, b] = await Promise.all([request(url), request(url)]);
  assert.equal(calls, 1);
  assert.equal(a.value, 42);
  assert.notEqual(a, b);
});
test("429 can serve an expired persistent response without replacing it with a fabricated observation", async (t) => {
  const url = "https://example.com/v4-stale";
  storage.set(
    `aetheris-data-v2:${url}`,
    JSON.stringify({ expires: 1, body: '{"temperature":7.2}' }),
  );
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("", { status: 429 }),
  );
  assert.equal((await request(url)).temperature, 7.2);
});
test("malformed or missing batch members recover individually from the city cache", () => {
  const c = {
    ...city,
    name: "Cold cache",
    latitude: 63.111,
    longitude: 10.222,
  };
  const live = parseCityBatch(rawCity(c, -3), [c]);
  const fallback = parseCityBatch([], [c]);
  assert.equal(live[0].temperature, -3);
  assert.equal(fallback[0].temperature, -3);
  assert.equal(fallback[0].source, "cached");
});
test("a first-run offline city is visibly seasonal rather than labeled live", () => {
  const result = initialCityTelemetry({
    ...city,
    latitude: -43.567,
    longitude: 172.912,
  });
  assert.equal(result.source, "seasonal");
  assert.ok(Number.isFinite(result.temperature));
  assert.equal(result.hourly.time.length, 72);
});
test("ensemble parser preserves each real suffixed series and fills only missing samples", () => {
  const w = forecast();
  const hourly = { time: w.hourly.time.map((t) => Date.parse(t) / 1000) };
  MODEL_IDS.forEach((m, j) => {
    for (const field of ["temperature_2m", "precipitation", "wind_speed_10m"])
      hourly[`${field}_${m}`] = w.hourly.time.map((_, i) =>
        field === "temperature_2m"
          ? 5 + j + i
          : field === "precipitation"
            ? 0.1
            : 10 + j,
      );
  });
  hourly.temperature_2m_gfs_seamless[6] = null;
  const result = parseEnsemble({ hourly }, w);
  assert.equal(result.hourly.temperature_2m_ecmwf_ifs04[6], 11);
  assert.equal(result.hourly.temperature_2m_icon_seamless[6], 13);
  assert.ok(Number.isFinite(result.hourly.temperature_2m_gfs_seamless[6]));
  assert.deepEqual(result.estimatedModels, ["gfs_seamless"]);
  assert.equal(hourly.temperature_2m_gfs_seamless[6], null);
});
test("estimated ensemble curves remain distinct and widen with forecast horizon", () => {
  const result = parseEnsemble(undefined, forecast()),
    h = result.hourly;
  const spread = (i) =>
    Math.max(...MODEL_IDS.map((m) => h[`temperature_2m_${m}`][i])) -
    Math.min(...MODEL_IDS.map((m) => h[`temperature_2m_${m}`][i]));
  assert.equal(result.estimatedModels.length, 3);
  assert.ok(spread(36) > spread(3));
  assert.ok(spread(0) > 0);
});
test("climate fallback never labels synthetic bounds as historical records", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("", { status: 429 }),
  );
  const result = await fetchClimate(
    { ...city, latitude: 52.871, longitude: 72.789 },
    undefined,
    new Date("2026-10-17T06:00Z"),
  );
  assert.equal(result.source, "estimated");
  assert.equal(result.years, 0);
  assert.deepEqual(result.dailyMeans, []);
  assert.ok(result.low < result.mean && result.high > result.mean);
  assert.match(result.note, /not historical records/);
});
test("climate archive is a single ten-year window and calendar-date normal is cached", async (t) => {
  const c = { ...city, latitude: 50.321, longitude: 70.321 };
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (input) => {
    calls++;
    const u = new URL(input);
    assert.equal(u.searchParams.get("start_date"), "2014-01-01");
    assert.equal(u.searchParams.get("end_date"), "2023-12-31");
    return new Response(
      JSON.stringify({
        daily: {
          time: ["2014-10-17", "2015-10-17", "2015-10-18"],
          temperature_2m_mean: [4, 6, 20],
          temperature_2m_min: [0, 2, 12],
          temperature_2m_max: [8, 10, 25],
        },
      }),
    );
  });
  const a = await fetchClimate(c, undefined, new Date("2026-10-17T06:00Z")),
    b = await fetchClimate(c, undefined, new Date("2026-10-17T07:00Z"));
  assert.equal(calls, 1);
  assert.equal(a.mean, 5);
  assert.equal(a.years, 2);
  assert.equal(b.source, "cached");
});
test("commute clothing accounts for cold return, peak rain and gusts across the complete outing", () => {
  const w = forecast();
  w.hourly.precipitation_probability = w.hourly.time.map(() => 0);
  for (const k of [7, 8, 9, 10]) {
    w.hourly.temperature_2m[k] = 11;
    w.hourly.apparent_temperature[k] = 9;
  }
  w.hourly.temperature_2m[10] = 3;
  w.hourly.apparent_temperature[10] = -1;
  w.hourly.precipitation_probability[10] = 80;
  w.hourly.wind_gusts_10m[9] = 48;
  const out = commuteOutfit(w, "evening");
  assert.equal(out.from, "18:00");
  assert.equal(out.to, "21:00");
  assert.equal(out.cold, -1);
  assert.equal(out.warm, 11);
  assert.equal(out.rain, 80);
  assert.equal(out.wind, 48);
  assert.match(
    out.layers.find((p) => p.key === "umbrella").recommendation,
    /hood/,
  );
  assert.match(
    out.layers.find((p) => p.key === "outer").recommendation,
    /insulated/,
  );
  assert.match(out.tip, /warm layer/);
});
test("a finished commute window resolves to the next local day", () => {
  const result = commuteOutfit(forecast(), "morning");
  assert.equal(result.date, "2026-10-18");
  assert.equal(result.from, "08:00");
  assert.equal(result.to, "10:00");
});
test("bicubic field preserves a uniform velocity and exact grid nodes", () => {
  const grid = Array.from({ length: 16 }, () => 12);
  assert.equal(bicubic(grid, 4, 4, 1.3, 2.1), 12);
  assert.equal(
    bicubic(
      Array.from({ length: 16 }, (_, i) => i),
      4,
      4,
      2,
      1,
    ),
    6,
  );
});
test("low cloud obstruction reduces creative sky vividness", () => {
  const a = { high: 45, mid: 45, low: 5, aod: 0.08, humidity: 50 };
  assert.ok(skyAesthetics(a).score > skyAesthetics({ ...a, low: 95 }).score);
  assert.equal(skyAesthetics(a).palette.length, 5);
  assert.equal(
    approximateClimate(city, new Date("2026-10-17")).source,
    "estimated",
  );
});

test("current ECMWF 0.25-degree series replaces an empty legacy feed without inventing model values", () => {
  const w = forecast(),
    raw = { hourly: { time: w.hourly.time.map((t) => Date.parse(t) / 1000) } };
  for (const field of ["temperature_2m", "precipitation", "wind_speed_10m"]) {
    raw.hourly[`${field}_ecmwf_ifs04`] = w.hourly.time.map(() => null);
    raw.hourly[`${field}_ecmwf_ifs025`] = w.hourly.time.map(() => 12.3);
  }
  const result = parseEnsemble(raw, w);
  assert.equal(result.hourly.temperature_2m_ecmwf_ifs04[4], 12.3);
  assert.equal(result.modelSources.ecmwf_ifs04, "ecmwf_ifs025");
  assert.ok(!result.estimatedModels.includes("ecmwf_ifs04"));
});
