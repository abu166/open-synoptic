import { request } from "./openMeteoClient";
import type { City } from "../types/telemetry";
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<City> {
  const d = await request<{ address: Record<string, string> }>(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
  );
  return {
    name:
      d.address.suburb ||
      d.address.neighbourhood ||
      d.address.city ||
      d.address.town ||
      d.address.village ||
      d.address.county ||
      "Selected location",
    country: d.address.country || "",
    latitude,
    longitude,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}
