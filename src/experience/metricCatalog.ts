import {
  value,
  todayMean,
  type Forecast,
  type AirQuality,
} from "../types/telemetry";
import {
  wetBulb,
  vaporPressureDeficit,
  airDensity,
} from "../lib/meteorology/physics";
import { solarPosition, lunarPhase } from "../lib/meteorology/ephemeris";
export interface MetricDefinition {
  key: string;
  label: string;
  unit: string;
  plain: string;
  pro: string;
  meaning: string;
  range: [number, number];
  reference: [number, number];
  read: (w: Forecast, a: AirQuality | undefined, i: number) => number;
}
const hourly =
  (key: string) => (w: Forecast, _a: AirQuality | undefined, i: number) =>
    value(w.hourly, key, i);
const air =
  (key: string) => (w: Forecast, a: AirQuality | undefined, i: number) => {
    if (!a) return NaN;
    const index = a.hourly.time.indexOf(w.hourly.time[i]);
    return index >= 0 ? value(a.hourly, key, index) : NaN;
  };
export const metrics: MetricDefinition[] = [
  {
    key: "air_density",
    label: "The weight of a breath of air",
    unit: "kg/m³",
    plain:
      "Cold, dense air gives your bike and body a little more air to push through. Warm air is usually lighter.",
    pro: "Moist-air density from the ideal-gas mixture of dry air and water vapor, using modeled surface pressure, temperature, and relative humidity.",
    meaning: "A small but real part of aerodynamic drag.",
    range: [0.8, 1.5],
    reference: [1.1, 1.3],
    read: (w, _a, i) =>
      airDensity(
        value(w.hourly, "temperature_2m", i),
        value(w.hourly, "relative_humidity_2m", i),
        value(w.hourly, "surface_pressure", i),
      ),
  },
  {
    key: "temperature_2m",
    label: "The temperature",
    unit: "°C",
    plain:
      "The shade temperature, about head height above the ground. Sun, wind, and moisture change how it feels on your skin.",
    pro: "Model near-surface air temperature at 2 m. This is a gridded forecast, not a local thermometer observation.",
    meaning: "A starting point for layers, not the whole story.",
    range: [-30, 45],
    reference: [10, 24],
    read: hourly("temperature_2m"),
  },
  {
    key: "apparent_temperature",
    label: "How it feels",
    unit: "°C",
    plain:
      "The temperature your body might notice after the breeze, humidity, and sunlight have had their say.",
    pro: "Open-Meteo apparent temperature combines heat index, wind chill, and radiation effects according to the provider methodology.",
    meaning: "Dress for this if it differs noticeably from the thermometer.",
    range: [-35, 45],
    reference: [10, 24],
    read: hourly("apparent_temperature"),
  },
  {
    key: "wet_bulb",
    label: "Wet-bulb temperature",
    unit: "°C",
    plain:
      "Imagine a damp cloth around a thermometer. Evaporation cools it. When this number stays high, sweat has less room to cool you.",
    pro: "Stull empirical wet-bulb approximation from air temperature and relative humidity. It has a limited validity domain and is not measured WBGT.",
    meaning:
      "A warmth-and-moisture clue, not a personal heat-safety guarantee.",
    range: [-10, 35],
    reference: [5, 22],
    read: (w, _a, i) =>
      wetBulb(
        value(w.hourly, "temperature_2m", i),
        value(w.hourly, "relative_humidity_2m", i),
      ),
  },
  {
    key: "relative_humidity_2m",
    label: "Moisture in the air",
    unit: "%",
    plain:
      "How full the air is with water vapor compared with what it can hold at this temperature.",
    pro: "Relative humidity at 2 m. RH depends strongly on temperature; dew point is a better measure of absolute moisture.",
    meaning:
      "Higher humidity can feel clammy in warmth; low humidity can feel drying.",
    range: [0, 100],
    reference: [30, 60],
    read: hourly("relative_humidity_2m"),
  },
  {
    key: "dew_point_2m",
    label: "Dew point",
    unit: "°C",
    plain:
      "Cool the air to this temperature and water starts to collect as dew. A higher dew point usually means a muggier feeling.",
    pro: "Temperature at which the modeled air parcel reaches saturation at constant pressure and moisture content.",
    meaning:
      "A small temperature–dew point gap is a clue for lens fogging and dew.",
    range: [-25, 30],
    reference: [3, 16],
    read: hourly("dew_point_2m"),
  },
  {
    key: "vapour_pressure_deficit",
    label: "How thirsty the air is",
    unit: "kPa",
    plain:
      "Dry air has more room for water. It can pull moisture from leaves, damp clothes, and your skin faster.",
    pro: "Vapor pressure deficit = saturation vapor pressure × (1 − RH/100), using the Tetens saturation approximation.",
    meaning: "High VPD can mean quicker drying and greater plant water demand.",
    range: [0, 4],
    reference: [0.4, 1.6],
    read: (w, _a, i) =>
      vaporPressureDeficit(
        value(w.hourly, "temperature_2m", i),
        value(w.hourly, "relative_humidity_2m", i),
      ),
  },
  {
    key: "pressure_msl",
    label: "The weight of the air",
    unit: "hPa",
    plain:
      "Air has weight. This reading follows that weight. A big change can signal a changing weather pattern.",
    pro: "Mean sea-level pressure; reduction to sea level makes pressure comparable across elevations. Tendency matters more than one value.",
    meaning:
      "If weather shifts are a personal headache trigger, track your own pattern rather than treating this as a diagnosis.",
    range: [960, 1050],
    reference: [1000, 1030],
    read: hourly("pressure_msl"),
  },
  {
    key: "wind_speed_10m",
    label: "The everyday breeze",
    unit: "km/h",
    plain:
      "The steady breeze above open ground. Buildings, trees, and street corners can make it feel very different where you stand.",
    pro: "Modeled wind speed at 10 m above ground; terrain and local roughness affect actual exposure.",
    meaning: "A headwind can turn an easy ride into a workout.",
    range: [0, 100],
    reference: [0, 25],
    read: hourly("wind_speed_10m"),
  },
  {
    key: "wind_speed_80m",
    label: "Wind above the rooftops",
    unit: "km/h",
    plain:
      "The wind can be much stronger just a little higher up. A calm pavement does not always mean calm air for a drone.",
    pro: "Modeled 80 m wind speed. This is not a flight-level observation or an operational briefing.",
    meaning: "Compare with surface wind before assuming the air is uniform.",
    range: [0, 140],
    reference: [0, 36],
    read: hourly("wind_speed_80m"),
  },
  {
    key: "wind_shear",
    label: "The wind changes with height",
    unit: "km/h",
    plain:
      "The difference between rooftop-height and surface wind. Bigger differences mean the breeze is less uniform as you climb.",
    pro: "Speed shear here is U80 − U10. This scalar difference omits vector direction shear and does not diagnose turbulence by itself.",
    meaning:
      "Useful context for airborne activities; not a turbulence measurement.",
    range: [-20, 70],
    reference: [0, 15],
    read: (w, _a, i) =>
      value(w.hourly, "wind_speed_80m", i) -
      value(w.hourly, "wind_speed_10m", i),
  },
  {
    key: "wind_gusts_10m",
    label: "The strongest gusts",
    unit: "km/h",
    plain:
      "The short bursts that catch a coat, shake a branch, or make you tighten your grip.",
    pro: "Provider forecast maximum gust at 10 m over the relevant model output interval.",
    meaning:
      "Gusts often matter more than the average wind for comfort and handling.",
    range: [0, 140],
    reference: [0, 30],
    read: hourly("wind_gusts_10m"),
  },
  {
    key: "cape",
    label: "Storm-building energy",
    unit: "J/kg",
    plain:
      "Warm air sometimes has room to rise like a balloon. More energy gives storms more fuel, if something starts them.",
    pro: "Convective Available Potential Energy: integrated positive buoyancy of a parcel. CAPE alone does not predict storm initiation or severity.",
    meaning: "A fuel gauge, not a promise that thunder will happen.",
    range: [0, 4000],
    reference: [0, 500],
    read: hourly("cape"),
  },
  {
    key: "lifted_index",
    label: "Will rising air keep rising?",
    unit: "K",
    plain:
      "A clue about whether a warm bubble of air wants to keep climbing. Negative numbers can mean a more restless atmosphere.",
    pro: "Lifted index is environmental minus lifted-parcel temperature near 500 hPa; negative values imply parcel buoyancy for that convention.",
    meaning: "Read together with moisture, CAPE, and a lifting mechanism.",
    range: [-12, 20],
    reference: [0, 12],
    read: hourly("lifted_index"),
  },
  {
    key: "aerosol_optical_depth",
    label: "The haze between you and the sky",
    unit: "AOD",
    plain:
      "Tiny floating particles can soften the horizon and wash out stars. A lower number generally means a clearer column of air.",
    pro: "Aerosol optical depth is a dimensionless measure of aerosol light extinction through the atmospheric column, not ground-level AQI.",
    meaning:
      "Useful for photography and astronomy; it does not replace pollution readings.",
    range: [0, 2],
    reference: [0, 0.2],
    read: air("aerosol_optical_depth"),
  },
  {
    key: "us_aqi",
    label: "Air worth taking a deep breath in",
    unit: "US AQI",
    plain:
      "A color-coded summary of air pollution. Lower is better. Your own sensitivity matters too.",
    pro: "Provider US AQI aggregation from pollutant concentrations. Forecast values and regional representativeness have uncertainty.",
    meaning:
      "0–50 is the US “Good” category. Consider your sensitivity as values rise.",
    range: [0, 300],
    reference: [0, 50],
    read: air("us_aqi"),
  },
  {
    key: "cloud_cover",
    label: "The sky’s soft blanket",
    unit: "%",
    plain:
      "How much of the sky is covered by cloud. Thick cloud makes the light softer, but can hide the stars.",
    pro: "Modeled total cloud cover. It is not simply the sum of low, middle, and high cloud fractions.",
    meaning: "For stargazing, cloud usually matters before temperature.",
    range: [0, 100],
    reference: [0, 30],
    read: hourly("cloud_cover"),
  },
  {
    key: "precipitation_probability",
    label: "The umbrella question",
    unit: "%",
    plain:
      "The forecast chance of precipitation in that hour. A chance is not a guarantee, and it does not tell you how heavy the rain will be.",
    pro: "Hourly precipitation probability as supplied by Open-Meteo; pair it with forecast accumulation and local radar.",
    meaning:
      "High probability plus meaningful accumulation is a good reason to pack a hood.",
    range: [0, 100],
    reference: [0, 30],
    read: hourly("precipitation_probability"),
  },
  {
    key: "direct_radiation",
    label: "Sunlight finding its way through",
    unit: "W/m²",
    plain:
      "Sunlight reaching the ground directly from the sun. Clouds can turn a bright beam into softer, scattered light.",
    pro: "Direct shortwave solar radiation averaged over the preceding hour; this is not UV exposure or a measured biological response.",
    meaning:
      "A daylight opportunity cue. It cannot measure serotonin or vitamin D.",
    range: [0, 1000],
    reference: [100, 600],
    read: hourly("direct_radiation"),
  },
  {
    key: "uv_index",
    label: "Sun protection matters",
    unit: "UV",
    plain:
      "A guide to the strength of sunburn-causing ultraviolet light, even when the air feels cool.",
    pro: "Modeled UV index. A UV index of 3 or greater is commonly used as a sun-protection action threshold.",
    meaning: "Check UV separately from sunshine and temperature.",
    range: [0, 12],
    reference: [0, 3],
    read: hourly("uv_index"),
  },
  {
    key: "visibility",
    label: "How far the world opens up",
    unit: "km",
    plain:
      "How far through the air you may be able to see. Mist, haze, rain, or snow can shrink the horizon.",
    pro: "Modeled horizontal visibility converted from meters to kilometers; local terrain and conditions may differ.",
    meaning: "A useful planning cue for the road and the view.",
    range: [0, 60],
    reference: [10, 50],
    read: (w, _a, i) => value(w.hourly, "visibility", i) / 1000,
  },
  {
    key: "freezing_level_height",
    label: "Where the air turns to ice",
    unit: "m",
    plain:
      "The height where air temperature crosses freezing. Ground conditions can be different, especially in inversions.",
    pro: "Modeled altitude of the 0°C isotherm. It is not a complete icing forecast or a guarantee of precipitation phase at the surface.",
    meaning: "One piece of the mountain and aviation weather picture.",
    range: [0, 6000],
    reference: [1000, 4000],
    read: hourly("freezing_level_height"),
  },
  {
    key: "soil_moisture_0_to_1cm",
    label: "How the ground feels",
    unit: "m³/m³",
    plain:
      "A model estimate of water in the top centimeter of soil. It hints at drying or dampness, but soil type matters.",
    pro: "Volumetric soil water content in the 0–1 cm layer; a grid-cell estimate rather than a garden probe.",
    meaning: "Look at recent rain and soil type before deciding to water.",
    range: [0, 0.6],
    reference: [0.15, 0.35],
    read: hourly("soil_moisture_0_to_1cm"),
  },
  {
    key: "sun_elevation",
    label: "The light’s angle",
    unit: "°",
    plain:
      "How high the sun is above the horizon. Low angles bring long shadows and warmer-looking light.",
    pro: "Computed geometric solar altitude from date and coordinates. Local topography and refraction can change observed horizon crossings.",
    meaning: "Golden-hour light lives near the horizon.",
    range: [-90, 90],
    reference: [-6, 6],
    read: (w, _a, i) =>
      solarPosition(new Date(w.hourly.time[i]), w.latitude, w.longitude)
        .elevation,
  },
  {
    key: "moon_illumination",
    label: "A little moonlight",
    unit: "%",
    plain:
      "How much of the Moon’s face is lit from our point of view. Bright moonlight can wash out fainter stars.",
    pro: "Approximate geocentric illuminated fraction from Sun–Moon geometry; local altitude determines whether the Moon is above the horizon.",
    meaning: "For a deep-sky photo, both phase and moonrise matter.",
    range: [0, 100],
    reference: [0, 25],
    read: (w, _a, i) =>
      lunarPhase(new Date(w.hourly.time[i])).illumination * 100,
  },
  {
    key: "daily_mean",
    label: "This day in a longer story",
    unit: "°C",
    plain:
      "The forecast average temperature for the whole day, compared in the climate panel with this calendar date over a cached ten-year archive window, or a labeled seasonal estimate.",
    pro: "API daily temperature mean. The climate baseline uses daily means for the same local calendar date in 2014–2023. When the archive is delayed, the panel labels a latitude/season estimate.",
    meaning:
      "An unusual day is one piece of context, not a climate trend on its own.",
    range: [-25, 40],
    reference: [5, 25],
    read: (w) => todayMean(w),
  },
];
export function metricsForCard(title: string) {
  const t = title.toLowerCase();
  const keys =
    t.includes("wind") ||
    t.includes("breeze") ||
    t.includes("gust") ||
    t.includes("rooftops")
      ? ["wind_speed_10m", "wind_gusts_10m", "wind_speed_80m", "wind_shear"]
      : t.includes("sun") ||
          t.includes("moon") ||
          t.includes("chase a little light") ||
          t.includes("color could")
        ? ["sun_elevation", "moon_illumination", "direct_radiation", "uv_index"]
        : t.includes("air quality") || t.includes("deeper breath")
          ? ["us_aqi", "aerosol_optical_depth", "relative_humidity_2m"]
          : t.includes("comfort") ||
              t.includes("pressure") ||
              t.includes("skin") ||
              t.includes("wear") ||
              t.includes("dressed") ||
              t.includes("being human") ||
              t.includes("meets your body")
            ? [
                "apparent_temperature",
                "wet_bulb",
                "vapour_pressure_deficit",
                "pressure_msl",
                "dew_point_2m",
              ]
            : t.includes("column") || t.includes("above your head")
              ? ["cape", "lifted_index", "freezing_level_height", "cloud_cover"]
              : t.includes("perspective") || t.includes("climate")
                ? ["daily_mean", "temperature_2m"]
                : t.includes("rain") ||
                    t.includes("precipitation") ||
                    t.includes("possibility") ||
                    t.includes("radar") ||
                    t.includes("sky in motion")
                  ? [
                      "precipitation_probability",
                      "cloud_cover",
                      "visibility",
                      "wind_gusts_10m",
                    ]
                  : t.includes("daylight")
                    ? ["direct_radiation", "sun_elevation", "uv_index"]
                    : [
                        "temperature_2m",
                        "apparent_temperature",
                        "cloud_cover",
                        "wind_speed_10m",
                        "relative_humidity_2m",
                      ];
  return keys.map((k) => metrics.find((m) => m.key === k)!).filter(Boolean);
}
