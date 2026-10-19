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

Regression coverage also includes multi-city request batching, per-city stale recovery, in-flight deduplication, 429 stale-cache behavior, suffixed model parsing and current ECMWF aliasing, widening scenario spread, one-window archive caching, worst-case commute layers, finished-window timezone handling, bicubic field interpolation and cloud-obstructed sky aesthetics.

## Personal plans and sky calendar

Overview now starts with a compact next-24-hour briefing: what matters, when to go, and what to prepare. Detailed charts remain in Forecast, and maps remain in Radar & satellite.

Intelligence contains saved plans for a commute, walk, run or outdoor event. Plans support one date or recurring weekdays, a departure range, half-hour duration increments, optional return departure, rain/gust/feels-like hard limits, daylight requirements and a preferred temperature. Planning covers seven days. Every sampled hour of both journeys must meet all hard limits; incomplete data cannot qualify. Within the nearest qualifying local day, windows rank by preferred temperature, rain and wind. A non-overlapping backup is shown when available. Half-hour trips conservatively use their containing hourly forecast sample. Form controls explicitly use °C and km/h; result cards follow the selected measurement system. Plans, personal feedback and bounded forecast history persist on this device; no account or server is required. Delete has an Undo action until the planner unmounts or another plan is removed.

Plan links contain the selected coordinates and preferences and open an editable draft; importing does not automatically save it. Calendar downloads contain concrete UTC events for the recommended outward and optional return journey. These exported events do not subsequently update. Feedback can propose stricter personal limits for review without modifying the meteorological forecast.

Fresh forecast snapshots are compared at matching valid times. The in-app feed records changes of at least 3°C apparent temperature, 20 percentage points rain probability, or 10 km/h gust. Duplicate alerts for the same field/hour have a three-hour cooldown. Plan cards compare their previous and current qualifying window and show relevant changes, including the return journey. At most 24 snapshots per location and 10 locations are retained. Checks run while the app is open; there is no server scheduler or background push notification service.

Confidence details lazily request real ICON global ensemble members. The display reports the raw departure-hour fraction with at least 0.1 mm precipitation, the fraction exceeding the plan's gust limit when that variable is available, and the temperature P10–P90 range. Member counts vary by variable and location; missing values remain unavailable. These fractions are not calibrated outing probabilities. Synthetic scenario curves from the existing deterministic model workbench never enter decisions or ensemble fractions. Deterministic model parsing now also records real/generated provenance for every value; the plan input inspector shows valid time, primary model selection, source and missing samples. Forecast retrieval timestamps survive cache fallback.

Forecast's on-demand verification view compares ECMWF, GFS and ICON temperature, sustained wind and precipitation amounts at 24- and 72-hour lead times against ERA5 reanalysis. It uses a recent 15-day hourly sample ending seven days ago, aligns valid times in UTC, excludes missing pairs, and reports sample count, MAE and signed bias. Evidence can be exported as JSON. ERA5 is a gridded reconstruction, not a station observation. The app does not claim probability calibration, automatic model weighting, station accuracy, or observed plan success from this sample. See the [previous-runs documentation](https://open-meteo.com/en/docs/previous-runs-api) and [ensemble documentation](https://open-meteo.com/en/docs/ensemble-api).

The sky planner in Overview and Intelligence provides seven local days of sunrise/sunset, morning/evening golden hour (solar altitude −4° to +6°), blue hour (−6° to −4°), and astronomical darkness (below −18°). Intervals are numerically solved and clipped at actual local-day boundaries, including daylight saving transitions. Polar conditions explicitly show absent crossings or day-boundary intervals. Window details include solar azimuth, cloud-based light recipes, and moonlight context for dark-sky viewing. Haze assumptions and missing cloud forecasts are labeled. The lunar calendar explains full moons, shows approximate illumination and moonrise/set, solves upcoming new/full/quarter phase crossings, and exports phase reminders or sky windows to calendars. Phase times use the existing compact astronomical model, not an observatory ephemeris. Lunar horizon crossings use the geometric center at 0° without refraction; terrain and light pollution are not modeled.

## Installation and offline use

Production builds include a relative-scope manifest, install icons and a versioned service worker. After a successful online visit and worker installation, the app shell can start offline and reuse previously loaded location forecasts. An offline first visit cannot fabricate a primary forecast. Cross-origin provider requests are not intercepted by the worker. Cached weather retains its original retrieval timestamp and is labeled as saved. Old shell caches are removed when the new worker activates; an update can wait for older tabs to close. Browser installation availability varies; iOS uses Share → Add to Home Screen.

Run `npm run build && npm run check:offline` to validate all worker assets, manifest icons, navigation fallback and cache isolation. The planning regression suite covers hard limits, missing data, return journeys, shared-plan validation, calendar escaping/folding, change alignment and cooldown, ensemble filtering, archive pairing, fractional time zones, lunar solutions, polar cases and daylight saving days.
