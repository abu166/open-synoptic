export type SkyTheme = "clear" | "cloud" | "fog" | "rain" | "snow" | "storm";
export interface WmoCondition {
  description: string;
  severity: "low" | "moderate" | "severe";
  theme: SkyTheme;
}
const descriptions: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  4: "Visibility reduced by smoke",
  5: "Haze",
  6: "Widespread suspended dust",
  7: "Wind-raised dust or sand",
  8: "Dust or sand whirls",
  9: "Duststorm or sandstorm",
  10: "Mist",
  11: "Shallow fog patches",
  12: "Continuous shallow fog",
  13: "Lightning without audible thunder",
  14: "Precipitation not reaching ground",
  15: "Distant precipitation reaching ground",
  16: "Nearby precipitation reaching ground",
  17: "Thunderstorm without precipitation",
  18: "Squalls",
  19: "Funnel cloud",
  20: "Recent drizzle or snow grains",
  21: "Recent rain",
  22: "Recent snow",
  23: "Recent rain and snow",
  24: "Recent freezing precipitation",
  25: "Recent rain showers",
  26: "Recent snow showers",
  27: "Recent hail showers",
  28: "Recent fog",
  29: "Recent thunderstorm",
  30: "Decreasing slight duststorm",
  31: "Steady slight duststorm",
  32: "Increasing slight duststorm",
  33: "Decreasing severe duststorm",
  34: "Steady severe duststorm",
  35: "Increasing severe duststorm",
  36: "Slight drifting snow",
  37: "Heavy drifting snow",
  38: "Slight blowing snow",
  39: "Heavy blowing snow",
  40: "Fog at a distance",
  41: "Fog patches",
  42: "Thinning fog, sky visible",
  43: "Thinning fog, sky obscured",
  44: "Steady fog, sky visible",
  45: "Fog",
  46: "Thickening fog, sky visible",
  47: "Thickening fog, sky obscured",
  48: "Depositing rime fog",
  49: "Rime fog, sky obscured",
  50: "Intermittent light drizzle",
  51: "Light drizzle",
  52: "Intermittent moderate drizzle",
  53: "Moderate drizzle",
  54: "Intermittent dense drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  58: "Light drizzle and rain",
  59: "Heavy drizzle and rain",
  60: "Intermittent light rain",
  61: "Slight rain",
  62: "Intermittent moderate rain",
  63: "Moderate rain",
  64: "Intermittent heavy rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  68: "Light rain and snow",
  69: "Heavy rain and snow",
  70: "Intermittent light snow",
  71: "Slight snowfall",
  72: "Intermittent moderate snow",
  73: "Moderate snowfall",
  74: "Intermittent heavy snow",
  75: "Heavy snowfall",
  76: "Diamond dust",
  77: "Snow grains",
  78: "Isolated snow crystals",
  79: "Ice pellets",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  83: "Light rain and snow showers",
  84: "Heavy rain and snow showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  87: "Light snow pellet showers",
  88: "Heavy snow pellet showers",
  89: "Light hail showers",
  90: "Heavy hail showers",
  91: "Recent thunderstorm, light rain",
  92: "Recent thunderstorm, heavy rain",
  93: "Recent thunderstorm, light snow or hail",
  94: "Recent thunderstorm, heavy snow or hail",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  97: "Heavy thunderstorm",
  98: "Thunderstorm with duststorm",
  99: "Thunderstorm with heavy hail",
};
const classify = (code: number): WmoCondition => ({
  description: descriptions[code] ?? "Unknown conditions",
  severity:
    code >= 95 || code === 82 || code === 9
      ? "severe"
      : code >= 50
        ? "moderate"
        : "low",
  theme:
    code >= 95
      ? "storm"
      : (code >= 70 && code < 80) || (code >= 85 && code < 91)
        ? "snow"
        : code >= 50
          ? "rain"
          : code >= 40
            ? "fog"
            : code >= 2
              ? "cloud"
              : "clear",
});
export const wmoCodes: Record<number, WmoCondition> = Object.fromEntries(
  Array.from({ length: 100 }, (_, code) => [code, classify(code)]),
);
export const weatherDescription = (code: number) =>
  wmoCodes[code]?.description ?? "Unknown conditions";
