import test from "node:test";
import assert from "node:assert/strict";
import {
  wetBulb,
  vaporPressureDeficit,
  airDensity,
  windChill,
  beaufort,
} from "../src/lib/meteorology/physics.ts";
import {
  solarPosition,
  solarWindows,
  lunarPhase,
} from "../src/lib/meteorology/ephemeris.ts";
import { dateKey, zonedMidnight } from "../src/lib/meteorology/time.ts";
const near = (actual, expected, tolerance) =>
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `${actual} differs from ${expected}`,
  );
test("Stull wet-bulb reference case and saturated air", () => {
  near(wetBulb(30, 50), 22.3, 0.02);
  near(wetBulb(20, 100), 20, 0.2);
});
test("moist-air physics preserves units and saturation", () => {
  near(vaporPressureDeficit(20, 50), 1.169, 0.005);
  assert.equal(vaporPressureDeficit(20, 100), 0);
  near(airDensity(15, 0, 1013.25), 1.225, 0.002);
  assert.ok(airDensity(25, 100, 1013) < airDensity(25, 0, 1013));
});
test("wind chill and Beaufort boundary conditions", () => {
  near(windChill(-10, 20), -17.86, 0.02);
  assert.equal(windChill(20, 30), 20);
  assert.equal(beaufort(0), 0);
  assert.equal(beaufort(118), 12);
});
test("local dates cross UTC midnight correctly", () => {
  const d = new Date("2026-10-17T21:00:00Z");
  assert.equal(dateKey(d, "Asia/Tokyo"), "2026-10-18");
  assert.equal(
    zonedMidnight(d, "Asia/Tokyo").toISOString(),
    "2026-10-17T15:00:00.000Z",
  );
  assert.equal(dateKey(d, "America/New_York"), "2026-10-17");
});
test("solar position tracks equinox and night", () => {
  assert.ok(
    solarPosition(new Date("2026-03-20T12:08:00Z"), 0, 0).elevation > 89,
  );
  assert.ok(
    solarPosition(new Date("2026-03-20T00:00:00Z"), 0, 0).elevation < -85,
  );
});
test("solar crossings retain sunrise/sunset order in Tokyo and handle polar day", () => {
  const d = new Date("2026-06-21T05:00:00Z"),
    windows = solarWindows(d, 35.68, 139.65, "Asia/Tokyo");
  assert.equal(windows.sunrise.length, 2);
  assert.ok(+windows.sunrise[0] < +windows.sunrise[1]);
  assert.equal(dateKey(windows.sunrise[0], "Asia/Tokyo"), "2026-06-21");
  assert.equal(solarWindows(d, 89, 0).sunrise.length, 0);
});
test("lunar illumination matches known full and new moon dates", () => {
  assert.ok(lunarPhase(new Date("2026-01-03T10:00:00Z")).illumination > 0.98);
  assert.ok(lunarPhase(new Date("2026-01-18T20:00:00Z")).illumination < 0.02);
});
import { scores } from "../src/lib/meteorology/activityScorer.ts";
test("activity scoring penalizes hazardous winds and never rewards daytime stargazing", () => {
  const make = (wind) => ({
    latitude: 51,
    longitude: 71,
    hourly: {
      time: [new Date().toISOString()],
      ...Object.fromEntries(
        Object.entries({
          temperature_2m: 15,
          relative_humidity_2m: 50,
          dew_point_2m: 5,
          wind_speed_10m: wind,
          wind_speed_80m: wind,
          wind_gusts_10m: wind * 1.4,
          precipitation: 0,
          cape: 0,
          cloud_cover_low: 0,
          cloud_cover_mid: 30,
          cloud_cover_high: 30,
          visibility: 10000,
          uv_index: 2,
          is_day: 1,
          freezing_level_height: 2000,
          soil_temperature_0cm: 15,
          soil_moisture_0_to_1cm: 0.25,
          et0_fao_evapotranspiration: 0.2,
        }).map(([key, value]) => [key, [value]]),
      ),
    },
  });
  const calm = scores(make(5), 0),
    storm = scores(make(100), 0);
  assert.ok(calm[1] > storm[1]);
  assert.equal(storm[1], 0);
  assert.equal(calm[2], 0);
  for (const score of calm) assert.ok(score >= 0 && score <= 100);
});
