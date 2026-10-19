# AETHERIS PRO

A responsive meteorological observatory built with React, TypeScript, Vite, TanStack Query, Zustand, Recharts, and MapLibre GL. It uses live public data, requires no API keys, and distinguishes live forecasts, saved forecasts, and explicitly labeled planning estimates.

## Live app and deployment

Use [AETHERIS PRO on GitHub Pages](https://abu166.github.io/open-synoptic/).

Pushes to `main` run the tests, verify the translation catalog, build, and deploy through GitHub Actions. The Pages build sets `GITHUB_PAGES=true` to serve assets under `/open-synoptic/`. Local and other hosting builds retain `/` as their base path. GitHub repository Settings → Pages must use **GitHub Actions** as the source.

## Run

Use Node.js 22.18 or newer.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The default location is Astana; Tokyo, New York, Zurich, and Reykjavik are pinned. `Cmd+K` / `Ctrl+K` opens location search. Location, saved cities, units, and ensemble preference persist locally. `?lat=...&lon=...&city=...` links restore a location. Browser GPS is available on localhost and HTTPS with the user's permission.

```sh
npm run check
npm test
npm run build
npm run preview
```

## Cinematic workspaces

Overview tells the local weather story with an emotional headline, a 24-hour time machine, clothing layers and practical comfort guidance. Radar & satellite opens a regional radar and rotating day/night globe. Forecast brings together multi-model charts, expanded daily dayparts and climate context. Intelligence contains explainable activity scores, running/cycling and drone planners, light planning and city comparison. Workspace links use `?view=overview|radar|forecast|intelligence`.

Drag the cinema timeline to preview weather across the interface, or play the day in 15 seconds. Forecast previews are labeled; radar's observation timeline remains independent. Every glass card has a working exploration button, plain-language/pro explanations, real hourly curves and relevant scenario controls. Activity deductions reconcile to the displayed score, and selecting a timeline hour opens that hour's factors.

The sound button opens a procedural mixer: rain on glass, wind, distant thunder, a temperature/solar-tuned ambient chord pad and a 432 Hz sine drone, with a real analyser-driven waveform and frequency spectrum. Audio starts only after a user gesture and continues when the mixer closes; turn it off using its power button.

## Features

- Dynamic atmospheric Canvas sky, wind-sensitive precipitation particles, snowfall, stars, aurora, lightning, and sun bloom; respects reduced motion.
- Opt-in procedural stereo rain, wind, thunder and ambient chords using Web Audio; independently adjustable layers.
- Current conditions and emotional weather guidance; dry nowcasts become animated micro-climate strips. Four-part daily inspectors include clothing recommendations.
- Five-mode 48-hour workbench: temperature, precipitation, vertical winds, cloud stratification, and instability/radiation. ECMWF, GFS, and ICON comparison includes the available-model minimum/maximum envelope.
- MapLibre regional map with sixteen-point bicubic forecast-interpolated wind fields, 1,400 colored particles and temperature/cloud heatmaps, CARTO basemap, RainViewer playback, opacity, palettes, scrubber, playback speed, and coordinate probes with Nominatim reverse lookup.
- Interactive WebGL planetary sphere with Natural Earth geography, Fresnel atmosphere, solar terminator, 48-point surface-wind flow, collision-managed live city beacons, drag orbit and coordinate selection.
- Solar/lunar trajectories, twilight thresholds, phase disc, wind rose, moist-air physics, pressure trends, AQI/pollen, atmospheric stability, and six activity scores with three-hour windows.
- Multi-city temperature, wind, and AQI comparisons; downloadable JSON and hourly CSV.
- Isolated source failures, abortable queries, timeouts, cached data, keyboard search, modal focus containment, and mobile layouts.

## Data and interpretation

[Open-Meteo forecast](https://open-meteo.com/en/docs), [air quality](https://open-meteo.com/en/docs/air-quality-api), [historical weather](https://open-meteo.com/en/docs/historical-weather-api), and geocoding power the forecast and climate panels. AQI and pollen coverage vary by region; missing readings are shown as unavailable. These are gridded forecasts and reanalyses, not street-level sensor measurements. Quarter-hour precipitation totals are multiplied by four for equivalent hourly intensity; snowfall retains its separate cm/h unit.

The climate baseline makes one ERA5 archive request spanning 2014–2023 and selects the current location's calendar date in each valid year. The API-provided forecast daily mean is compared against the API-provided historical daily means. Record bounds are that calendar date's extremes within this baseline, not all-time station records. The normal interval is the empirical P10–P90 range. February 29 uses only valid leap-year observations, and the sample count is displayed.

The multi-model envelope is a deterministic inter-model range, not a calibrated probability or an ensemble confidence interval. When the legacy ECMWF 0.4° feed contains nulls, the parser uses the current 0.25° feed. Missing model samples receive explicitly labeled scenario estimates based on pressure tendency, cloud variability and horizon; those are not additional numerical-model runs or calibrated confidence intervals. Cloud percentages are stratified by altitude; summing them does not represent total sky cover. CAPE, lifted index, and freezing height provide contextual stability guidance, not official warnings.

Solar/lunar coordinates use compact astronomical approximations. Twilight crossings are solved numerically; topography and variable atmospheric refraction are not modeled. Moon age and future phase countdowns are estimates. Stull wet-bulb and wind-chill formulas have limited validity domains; activity scores are planning heuristics, not medical advice, WBGT measurements, or aviation clearance.

[RainViewer's public API documentation](https://www.rainviewer.com/api/weather-maps-api.html) currently documents the past two hours of radar. The client also accepts future radar and infrared frames when supplied. When those products are absent, the interface says so; it never invents future radar or satellite imagery. Radar coverage is not global, and public tiles have zoom limits. CARTO/OpenStreetMap attribution remains visible. Natural Earth geography is loaded from its public repository.

All saved cities share one compact multi-coordinate forecast request and one shared query across the ribbon, globe and comparison arena. Successful forecasts persist locally for ten minutes; historical raw responses persist for thirty days and calendar-date normals have their own coordinate/date cache. Identical requests share an in-flight promise. Per-city saved snapshots survive partial batch failures; a first-ever offline visit uses a clearly labeled broad seasonal estimate, never a supposed live reading. Archive failures similarly use labeled latitude/season/elevation context without inventing historical records. HTTP 429 responses honor Retry-After or apply a three-minute origin cooldown. Estimated ensemble/climate responses automatically retry every three minutes; successful responses retain longer refresh intervals. Lazy map activation and offscreen animation suspension reduce network and GPU work. Public quotas remain outside this application’s control.

The commute architect evaluates every hour in five selectable outing windows, including the coldest feels-like temperature, gusts, rain risk and return-trip layer changes. Its interactive body map and four physiology gauges explain the weather inputs. Sky aesthetics predicts a five-color sunrise/sunset recipe from cloud levels, humidity and aerosol haze, with an interactive experiment. The outdoor hour matrix filters contiguous windows by duration, activity fit, rain and gust limits. Forecast’s altitude explorer distinguishes supplied 10/80/120 m levels from explicitly modeled upper-air extrapolation.

Pressure changes are presented as personal sensitivity cues, not migraine predictions. The daylight opportunity score is a transparent planning heuristic, not a serotonin or vitamin-D measurement. These panels include links to the American Migraine Foundation and NIMH.

Public services may impose rate limits and usage terms. No paid service or secret is needed for this local application; commercial deployment should review each provider's terms. Browser requests send selected coordinates to the relevant data providers.

## Verification

TypeScript and production builds are checked throughout implementation. Scientific regression tests cover wet-bulb temperature, moist-air density, VPD, wind chill, Beaufort limits, local-date boundaries, solar position, polar conditions, known moon phases, and hazardous-wind activity scoring. Additional regression tests cover time interpolation, missing forecast readings, AQI metadata and exact activity factor reconciliation. The live forecast, air-quality, multi-model, and historical archive responses were exercised during development. The MapLibre worker is explicitly emitted as a Vite asset to work in both development and production builds.

Browser interaction checks covered all four workspaces, day/night scrubbing, 15-second playback into real Reykjavik rain, the 390 × 844 layout, clothing layers, scenario controls, activity-hour inspection, audio power/mixing, daily dayparts, spatial wind rendering and a coordinate probe resolved through Nominatim. V4 browser samples measured 120 fps sky/globe and 121 fps for the 1,400-particle map on the development machine’s high-refresh display. These requestAnimationFrame measurements are local observations, not a cross-device guarantee. All five ribbon temperatures, real ECMWF/GFS/ICON model runs, archive samples, floating dock, globe city/coordinate selection, commute changes, physiological gauges and live audio spectrum were checked in the rendered browser.

The 28-test suite includes multi-city request batching, per-city stale recovery, in-flight deduplication, 429 stale-cache behavior, suffixed model parsing and current ECMWF aliasing, widening scenario spread, one-window archive caching, worst-case commute layers, finished-window timezone handling, bicubic field interpolation and cloud-obstructed sky aesthetics.
