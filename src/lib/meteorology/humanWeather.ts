import {
  currentIndex,
  value,
  todayDailyIndex,
  type Forecast,
} from "../../types/telemetry.ts";
import { solarPosition } from "./ephemeris.ts";
export function weatherStory(w: Forecast, city: string) {
  const c = w.current,
    sun = solarPosition(new Date(c.time * 1000), w.latitude, w.longitude),
    t = c.apparent_temperature;
  const attire =
    t < 0
      ? "Wrap up. A proper winter coat earns its place today."
      : t < 10
        ? "Bring a warm layer. The air has a little bite."
        : t < 18
          ? "A light jacket now, room to breathe later."
          : t < 28
            ? "Light layers, unhurried plans, a little time outside."
            : "Find the shade. Water and breathable layers come first.";
  if (c.weather_code >= 95)
    return {
      headline: `An electric sky over ${city}.`,
      detail:
        "Thunder is part of this chapter. Keep outdoor plans flexible and watch for official local alerts.",
      vibe: "STORM WATCH",
      action: "Make room for a quieter, sheltered afternoon.",
    };
  if (c.snowfall > 0 || [71, 73, 75, 77, 85, 86].includes(c.weather_code))
    return {
      headline: `The world softens into snow in ${city}.`,
      detail: `Cold cheeks. Quiet streets. ${attire}`,
      vibe: "SNOW GLOBE",
      action: "Warm socks, grippy shoes, and an extra few minutes.",
    };
  if (
    c.precipitation > 0.05 ||
    (c.weather_code >= 51 && c.weather_code < 70) ||
    [80, 81, 82].includes(c.weather_code)
  )
    return {
      headline: `Rain on the windows. A slower rhythm in ${city}.`,
      detail: `Pavements shine, the air feels close. ${attire}`,
      vibe: "RAIN-SOAKED",
      action: "A waterproof outer layer makes the day easier.",
    };
  if (sun.elevation >= -6 && sun.elevation < 9 && c.cloud_cover < 75)
    return {
      headline: `A little golden-hour magic in ${city}.`,
      detail: `The light is changing by the minute. ${attire}`,
      vibe: "BETWEEN LIGHT & NIGHT",
      action: "Step outside while the edges of the city turn gold.",
    };
  if (!c.is_day)
    return {
      headline: `The city exhales. A quieter hour in ${city}.`,
      detail: `${c.cloud_cover < 30 ? "A clear sky, a few stars, and a little perspective." : "Clouds draw a soft curtain over the night."} ${attire}`,
      vibe: "AFTER HOURS",
      action:
        c.cloud_cover < 20
          ? "Look up. There may be a sky worth staying out for."
          : "A warm drink and a softer light suit this hour.",
    };
  if (c.cloud_cover > 65)
    return {
      headline: `Silver skies. A crisp little pause in ${city}.`,
      detail: `${c.temperature_2m < 10 ? "Fresh air, cool hands, and a reason to slow down." : "A soft, diffused light settles over the city."} ${attire}`,
      vibe: "SOFT LIGHT, FRESH AIR",
      action: "Take the scenic route. There is beauty in a quiet sky.",
    };
  return {
    headline: `Sun on your face. ${city} is calling.`,
    detail: `${c.temperature_2m > 22 ? "Warm streets and wide-open possibilities." : "The air feels bright, clean, and full of possibility."} ${attire}`,
    vibe: "A DAY TO STEP INTO",
    action: "A little daylight belongs on your calendar.",
  };
}
export interface OutfitLayer {
  key: "head" | "outer" | "middle" | "shoes" | "umbrella";
  name: string;
  recommendation: string;
  reason: string;
}
export function wardrobe(w: Forecast): OutfitLayer[] {
  const c = w.current,
    t = c.apparent_temperature,
    i = currentIndex(w),
    rain = Math.max(
      ...Array.from({ length: 12 }, (_, j) =>
        value(w.hourly, "precipitation_probability", i + j),
      ).filter(Number.isFinite),
    ),
    snow = c.snowfall > 0 || [71, 73, 75, 77, 85, 86].includes(c.weather_code);
  return [
    {
      key: "head",
      name: "The finishing touch",
      recommendation:
        t < 0
          ? "Warm beanie + gloves"
          : c.is_day && c.cloud_cover < 40
            ? "Sunglasses, maybe a cap"
            : t < 8
              ? "A scarf feels right"
              : "Keep it light",
      reason:
        t < 8
          ? "Your ears and hands feel wind first."
          : c.is_day
            ? "Choose eye protection for brightness, not temperature."
            : "No sun accessories needed after dark.",
    },
    {
      key: "outer",
      name: "Your outer layer",
      recommendation:
        t < -8
          ? "Insulated winter parka"
          : t < 5
            ? "A warm, insulated coat"
            : t < 13
              ? "A wool coat or light puffer"
              : t < 20
                ? "A light jacket"
                : "Breathable shirt or tee",
      reason: `Dress for the ${Math.round(t)}°C feels-like temperature, rather than the thermometer alone.`,
    },
    {
      key: "middle",
      name: "A little extra warmth",
      recommendation:
        t < 8
          ? "Merino sweater / warm hoodie"
          : t < 18
            ? "A removable cotton layer"
            : "One airy layer is enough",
      reason: "Removable layers let you adjust between the street and indoors.",
    },
    {
      key: "shoes",
      name: "From the ground up",
      recommendation: snow
        ? "Insulated, grippy boots"
        : rain > 35
          ? "Water-resistant shoes"
          : "Comfortable everyday sneakers",
      reason: snow
        ? "Snow or ice may affect your footing."
        : rain > 35
          ? "Give wet pavements a little respect."
          : "No wet-weather footwear signal in the next 12 hours.",
    },
    {
      key: "umbrella",
      name: "The umbrella question",
      recommendation:
        rain > 35 ? "Take a compact umbrella" : "Leave it by the door",
      reason: Number.isFinite(rain)
        ? `${Math.round(rain)}% peak rain probability in the next 12 hours.${c.wind_gusts_10m > 40 ? " Strong gusts favor a hood over an umbrella." : ""}`
        : "Rain probability is unavailable; check the sky before leaving.",
    },
  ];
}
export function humanComfort(w: Forecast) {
  const c = w.current,
    i = currentIndex(w),
    delta =
      c.pressure_msl - value(w.hourly, "pressure_msl", Math.max(0, i - 24)),
    dew = value(w.hourly, "dew_point_2m", i),
    radiation = value(w.hourly, "direct_radiation", i),
    di = todayDailyIndex(w),
    sunshine = value(w.daily, "sunshine_duration", di);
  let best = i,
    peak = -1;
  for (let j = i; j < Math.min(w.hourly.time.length, i + 24); j++) {
    const light = value(w.hourly, "direct_radiation", j);
    if (light > peak) {
      peak = light;
      best = j;
    }
  }
  return {
    delta,
    dew,
    lightScore: Math.round(
      Math.max(
        0,
        Math.min(
          100,
          (1 - c.cloud_cover / 100) * 60 + Math.min(40, radiation / 8),
        ),
      ),
    ),
    sunshineHours: sunshine / 3600,
    bestLight: w.hourly.time[best],
    pressureTitle:
      Math.abs(delta) >= 6
        ? "A noticeable pressure swing"
        : "A steadier pressure day",
    pressureAdvice:
      Math.abs(delta) >= 6
        ? "If weather changes are a personal headache trigger, this is a useful day to track how you feel and keep familiar routines."
        : "The weather signal is relatively steady. Your own symptoms and routines matter more than this reading.",
    skinTitle:
      dew < 3
        ? "Crisp air. Low frizz, more static."
        : c.relative_humidity_2m > 75
          ? "A little extra curl in the air."
          : "A comfortable moisture balance.",
    skinAdvice:
      dew < 3
        ? "Lip balm and a light moisturizer may feel welcome. A soft cotton layer can help with static."
        : c.relative_humidity_2m > 75
          ? "Humidity can change how your hair behaves. Choose breathable layers if you feel clammy."
          : "Skin and hair should have fewer weather-related surprises.",
  };
}
