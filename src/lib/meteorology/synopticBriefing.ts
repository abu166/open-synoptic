import { currentIndex, value, type Forecast } from "../../types/telemetry";
import { weatherDescription } from "./wmoCodes";
export function synopticBriefing(w: Forecast, anomaly?: number) {
  const c = w.current,
    i = currentIndex(w),
    delta =
      c.pressure_msl - value(w.hourly, "pressure_msl", Math.max(0, i - 24)),
    shear = value(w.hourly, "wind_speed_80m", i) - c.wind_speed_10m;
  const rows = w.minutely_15.time
      .flatMap((t, j) =>
        +new Date(t) >= Date.now()
          ? [{ t, rate: value(w.minutely_15, "precipitation", j) * 4 }]
          : [],
      )
      .slice(0, 8),
    wet = rows.find((r) => r.rate > 0.05),
    pressure = Number.isFinite(delta)
      ? `${delta >= 0 ? "rising" : "falling"} ${Math.abs(delta).toFixed(1)} hPa in 24 hours`
      : "trend unavailable";
  const trajectory = wet
    ? `precipitation ${rows[0]?.rate > 0 ? "continues" : "arrives"} within ${Math.max(0, Math.round((+new Date(wet.t) - Date.now()) / 60000))} minutes`
    : "the next two hours look dry";
  const climate =
    anomaly === undefined
      ? "the historical baseline is pending"
      : `the forecast daily mean is ${Math.abs(anomaly).toFixed(1)}° ${anomaly >= 0 ? "above" : "below"} normal`;
  return `${weatherDescription(c.weather_code)} with ${c.wind_speed_10m.toFixed(0)} km/h winds and ${c.relative_humidity_2m}% humidity. Pressure is ${pressure}; ${trajectory}. Winds at 80 m are ${Math.abs(shear).toFixed(0)} km/h ${shear >= 0 ? "stronger" : "lighter"} than the surface, and ${climate}.`;
}
