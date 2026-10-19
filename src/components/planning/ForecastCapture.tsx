import { useEffect } from "react";
import type { Forecast, City } from "../../types/telemetry";
import { cityKey } from "../../api/resilience";
import { usePlanningStore } from "../../store/usePlanningStore";
import { snapshot } from "../../lib/planning/history";
export function ForecastCapture({
  weather,
  city,
}: {
  weather: Forecast;
  city: City;
}) {
  const capture = usePlanningStore((s) => s.capture);
  useEffect(() => {
    if (weather.provenance?.source === "live")
      capture(cityKey(city), snapshot(weather, weather.provenance.fetchedAt));
  }, [weather, city.latitude, city.longitude, capture]);
  return null;
}
