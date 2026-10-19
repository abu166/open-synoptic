export function forecast() {
  const start = Date.parse("2026-10-17T06:00:00Z"),
    hours = Array.from({ length: 48 }, (_, i) =>
      new Date(start + i * 3600000).toISOString(),
    ),
    fields = {
      temperature_2m: 10,
      apparent_temperature: 9,
      relative_humidity_2m: 50,
      dew_point_2m: 2,
      wind_speed_10m: 10,
      wind_speed_80m: 17,
      wind_speed_120m: 20,
      wind_gusts_10m: 18,
      wind_direction_10m: 350,
      precipitation: 0,
      rain: 0,
      showers: 0,
      snowfall: 0,
      cloud_cover: 25,
      cloud_cover_low: 10,
      cloud_cover_mid: 15,
      cloud_cover_high: 20,
      pressure_msl: 1010,
      surface_pressure: 990,
      weather_code: 2,
      is_day: 1,
      cape: 0,
      visibility: 10000,
      uv_index: 2,
      soil_temperature_0cm: 12,
      soil_moisture_0_to_1cm: 0.25,
      et0_fao_evapotranspiration: 0.1,
      freezing_level_height: 2500,
    };
  return {
    latitude: 51,
    longitude: 71,
    elevation: 300,
    timezone: "Asia/Almaty",
    current: { ...fields, time: start / 1000, interval: 900 },
    hourly: {
      time: hours,
      ...Object.fromEntries(
        Object.entries(fields).map(([k, v]) => [
          k,
          hours.map((_, i) =>
            k === "temperature_2m" ? v + i : k === "is_day" && i >= 8 ? 0 : v,
          ),
        ]),
      ),
    },
    daily: { time: [] },
    minutely_15: { time: [] },
  };
}
