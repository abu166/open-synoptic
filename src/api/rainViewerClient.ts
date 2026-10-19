import { request } from "./openMeteoClient";
import type { RadarData, RadarFrame } from "../types/telemetry";
export const fetchRadar = (signal?: AbortSignal) =>
  request<RadarData>(
    "https://api.rainviewer.com/public/weather-maps.json",
    signal,
  );
export const tileURL = (host: string, frame: RadarFrame, color = 2) =>
  `${host}${frame.path}/256/{z}/{x}/{y}/${color}/1_1.png`;
