import { createContext, useContext } from "react";
import { type Forecast, type AirQuality, type City } from "../types/telemetry";
export type Workspace = "overview" | "radar" | "forecast" | "intelligence";
export interface DiveRequest {
  title: string;
  metric?: string;
  activity?: number;
  time?: number;
}
export interface Experience {
  source: Forecast;
  weather: Forecast;
  air?: AirQuality;
  city: City;
  offset: number;
  workspace: Workspace;
  selectTime: (timestamp: number) => void;
  openDive: (request: DiveRequest) => void;
}
export const ExperienceContext = createContext<Experience | null>(null);
export function useExperience() {
  return useContext(ExperienceContext);
}
export { selectedWeather, selectedAir, selectedIndex } from "./forecastMoment";
