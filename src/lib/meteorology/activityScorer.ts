import { value, type Forecast, currentIndex } from "../../types/telemetry.ts";
import { wetBulb, windChill } from "./physics.ts";
import { solarPosition, lunarPhase } from "./ephemeris.ts";
export const activities = [
  "Endurance",
  "Drone flight",
  "Stargazing",
  "Photography",
  "Soil & turf",
  "Thermal comfort",
];
export interface ScoreFactor {
  label: string;
  observation: string;
  points: number;
}
export interface ActivityAnalysis {
  score: number;
  raw: number;
  factors: ScoreFactor[];
  available: boolean;
}
const number = (n: number, d = 0) =>
  Number.isFinite(n) ? n.toFixed(d) : "unavailable";
export function activityBreakdown(
  w: Forecast,
  i: number,
  aqi?: number,
  moon?: number,
  aerosol?: number,
): ActivityAnalysis[] {
  const v = (key: string) => value(w.hourly, key, i),
    t = v("temperature_2m"),
    rh = v("relative_humidity_2m"),
    dew = v("dew_point_2m"),
    wind = v("wind_speed_10m"),
    wind80 = v("wind_speed_80m"),
    gust = v("wind_gusts_10m"),
    rain = v("precipitation"),
    cape = v("cape"),
    low = v("cloud_cover_low"),
    mid = v("cloud_cover_mid"),
    high = v("cloud_cover_high"),
    visibility = v("visibility"),
    uv = v("uv_index"),
    soil = v("soil_temperature_0cm"),
    moisture = v("soil_moisture_0_to_1cm"),
    et = v("et0_fao_evapotranspiration"),
    sun = solarPosition(
      new Date(w.hourly.time[i]),
      w.latitude,
      w.longitude,
    ).elevation,
    illumination = moon ?? lunarPhase(new Date(w.hourly.time[i])).illumination,
    wet = wetBulb(t, rh),
    chill = windChill(t, wind),
    gustFactor = gust / Math.max(wind, 1);
  const f = (
    label: string,
    observation: string,
    points: number,
  ): ScoreFactor => ({ label, observation, points });
  const all: ScoreFactor[][] = [
    [
      f(
        "Temperature fit",
        `${number(t, 1)}°C · target 14°C`,
        Math.abs(t - 14) * 2.5,
      ),
      f(
        "Moisture load",
        `${number(dew, 1)}°C dew point`,
        Math.max(0, dew - 12) * 2,
      ),
      f("Gust exposure", `${number(gust)} km/h`, gust * 0.5),
      f("UV exposure", `${number(uv, 1)} UV`, uv * 2),
      f(
        "Air quality",
        aqi == null ? "Unavailable · omitted" : `${number(aqi)} US AQI`,
        aqi == null ? 0 : aqi * 0.18,
      ),
      f("Rain", `${number(rain, 1)} mm`, rain * 10),
    ],
    [
      f(
        "Surface / altitude wind",
        `${number(Math.max(wind, wind80))} km/h at the windier level`,
        Math.max(wind, wind80) * 1.4,
      ),
      f("Peak gust excess", `${number(gust)} km/h`, Math.max(0, gust - 25) * 2),
      f(
        "Gust variability",
        `${number(gustFactor, 1)}× sustained`,
        Math.max(0, gustFactor - 1.5) * 9,
      ),
      f("Precipitation", `${number(rain, 1)} mm`, rain * 30),
      f(
        "Visibility",
        `${number(visibility / 1000, 1)} km`,
        Math.max(0, 5000 - visibility) / 60,
      ),
      f("Convective energy", `${number(cape)} J/kg`, cape / 35),
      f(
        "Low freezing level",
        `${number(v("freezing_level_height"))} m`,
        Math.max(0, 400 - v("freezing_level_height")) / 15,
      ),
    ],
    [
      f(
        "Daylight interference",
        v("is_day") ? "Daytime sky" : "Night sky",
        v("is_day") ? 100 : 0,
      ),
      f("Low cloud obstruction", `${number(low)}%`, low * 0.6),
      f("Middle cloud veil", `${number(mid)}%`, mid * 0.35),
      f("High cloud veil", `${number(high)}%`, high * 0.3),
      f(
        "Aerosol haze",
        aerosol == null ? "Unavailable · omitted" : `${number(aerosol, 2)} AOD`,
        aerosol == null ? 0 : aerosol * 55,
      ),
      f("Humid air", `${number(rh)}% RH`, Math.max(0, rh - 75) * 1.2),
      f(
        "Lens-fog margin",
        `${number(t - dew, 1)}°C above dew point`,
        Math.max(0, 3 - (t - dew)) * 12,
      ),
      f(
        "Moon glare",
        `${number(illumination * 100)}% illuminated`,
        illumination * 25,
      ),
    ],
    [
      f(
        "Cloud texture balance",
        `${number((mid + high) / 2)}% average mid/high cloud`,
        Math.max(0, Math.abs((mid + high) / 2 - 45) - 20) * 1.4,
      ),
      f("Low cloud obstruction", `${number(low)}%`, low * 0.8),
      f(
        "Aerosol haze",
        aerosol == null ? "Unavailable · omitted" : `${number(aerosol, 2)} AOD`,
        aerosol == null ? 0 : aerosol * 35,
      ),
      f("Rain on the lens", `${number(rain, 1)} mm`, rain * 25),
      f(
        "Golden-hour light",
        `${number(sun, 1)}° solar elevation`,
        Math.max(0, Math.abs(sun - 1) - 5) * 5,
      ),
    ],
    [
      f(
        "Soil temperature fit",
        `${number(soil, 1)}°C · target 15°C`,
        Math.abs(soil - 15) * 2,
      ),
      f("Ground frost", `${number(soil, 1)}°C`, Math.max(0, -soil) * 10),
      f(
        "Wet ground",
        `${number(moisture, 2)} m³/m³`,
        Math.max(0, moisture - 0.35) * 220,
      ),
      f(
        "Dry ground",
        `${number(moisture, 2)} m³/m³`,
        Math.max(0, 0.15 - moisture) * 200,
      ),
      f("Water demand", `${number(et, 2)} mm ET₀`, Math.max(0, et - 0.4) * 15),
    ],
    [
      f(
        "Wet-bulb warmth",
        `${number(wet, 1)}°C wet-bulb`,
        Math.max(0, wet - 22) * 10,
      ),
      f(
        "Wind-chill cold",
        `${number(chill, 1)}°C wind chill`,
        Math.max(0, -chill) * 2.5,
      ),
      f("Strong UV", `${number(uv, 1)} UV`, Math.max(0, uv - 5) * 4),
    ],
  ];
  return all.map((factors) => {
    const raw = 100 - factors.reduce((sum, f) => sum + f.points, 0),
      available = Number.isFinite(raw);
    return {
      raw,
      score: available ? Math.max(0, Math.min(100, Math.round(raw))) : NaN,
      factors,
      available,
    };
  });
}
export function scores(
  w: Forecast,
  i: number,
  aqi?: number,
  moon?: number,
  aerosol?: number,
) {
  return activityBreakdown(w, i, aqi, moon, aerosol).map((a) => a.score);
}
export function bestWindow(
  w: Forecast,
  activity: number,
  aqi?: number,
  moon?: number,
  aerosol?: number,
) {
  const start = currentIndex(w);
  let best = start,
    max = -1;
  for (let i = start; i < Math.min(start + 24, w.hourly.time.length - 2); i++) {
    const score =
      [0, 1, 2].reduce(
        (a, n) => a + scores(w, i + n, aqi, moon, aerosol)[activity],
        0,
      ) / 3;
    if (score > max) {
      max = score;
      best = i;
    }
  }
  return w.hourly.time[best];
}
export const scoreColor = (score: number) =>
  !Number.isFinite(score)
    ? "#abb8c9"
    : score >= 70
      ? "#b8edc6"
      : score >= 40
        ? "#ffe0a0"
        : "#ffc4ad";
