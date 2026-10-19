import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { City, Units } from "../types/telemetry";
export const presets: City[] = [
  {
    name: "Astana",
    country: "Kazakhstan",
    latitude: 51.1694,
    longitude: 71.4491,
    timezone: "Asia/Almaty",
  },
  {
    name: "Tokyo",
    country: "Japan",
    latitude: 35.6762,
    longitude: 139.6503,
    timezone: "Asia/Tokyo",
  },
  {
    name: "New York",
    country: "United States",
    latitude: 40.7128,
    longitude: -74.006,
    timezone: "America/New_York",
  },
  {
    name: "Zurich",
    country: "Switzerland",
    latitude: 47.3769,
    longitude: 8.5417,
    timezone: "Europe/Zurich",
  },
  {
    name: "Reykjavik",
    country: "Iceland",
    latitude: 64.1466,
    longitude: -21.9426,
    timezone: "Atlantic/Reykjavik",
  },
];
interface Store {
  city: City;
  saved: City[];
  units: Units;
  ensemble: boolean;
  audio: boolean;
  setCity: (c: City) => void;
  setUnits: (u: Units) => void;
  toggleEnsemble: () => void;
  toggleAudio: () => void;
  removeCity: (name: string) => void;
}
export const useWeatherStore = create<Store>()(
  persist(
    (set) => ({
      city: presets[0],
      saved: presets,
      units: "metric",
      ensemble: false,
      audio: false,
      setCity: (city) =>
        set((s) => ({
          city,
          saved: [
            city,
            ...s.saved.filter(
              (c) =>
                c.name !== city.name &&
                (Math.abs(c.latitude - city.latitude) > 0.0001 ||
                  Math.abs(c.longitude - city.longitude) > 0.0001),
            ),
          ].slice(0, 10),
        })),
      setUnits: (units) => set({ units }),
      toggleEnsemble: () => set((s) => ({ ensemble: !s.ensemble })),
      toggleAudio: () => set((s) => ({ audio: !s.audio })),
      removeCity: (name) =>
        set((s) => ({ saved: s.saved.filter((c) => c.name !== name) })),
    }),
    {
      name: "aetheris-pro-v1",
      partialize: (s) => ({
        city: s.city,
        saved: s.saved,
        units: s.units,
        ensemble: s.ensemble,
      }),
    },
  ),
);
