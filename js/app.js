/**
 * Weather & Lightning Map — main app logic.
 * Map: Leaflet + OpenStreetMap/CARTO tiles.
 * Weather: Open-Meteo (https://open-meteo.com/) — free, no API key required.
 * Lightning: live feed from Blitzortung.org, see js/lightning.js.
 * Settings: see js/settings.js — core toggles live in the toolbar,
 * everything else lives behind the gear icon.
 */

const DEFAULT_CENTER = [51.505, -0.09]; // London
const DEFAULT_ZOOM = 6;

const TILE_LAYERS = {
  standard: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    options: {
      maxZoom: 18,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
};

const PIN_SVG =
  '<svg class="map-pin-icon" width="24" height="24" viewBox="0 0 24 24" style="fill:var(--sky)">' +
  '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" ' +
  'stroke="#fff" stroke-width="2" stroke-linejoin="round" paint-order="stroke"/>' +
  "</svg>";

const CLOUD_SUN_SVG =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<circle cx="8" cy="8" r="3.2"/>' +
  '<path d="M5 18h11a3.5 3.5 0 0 0 .5-6.96A5 5 0 0 0 7.1 9.9"/>' +
  "</svg>";

// --- Small hand-drawn weather-category icon set (used in the detail card) --
// Matches the app's existing stroke-icon style: currentColor, 1.8 stroke,
// round caps/joins, 24x24 viewBox. Real network access isn't available in
// this environment to pull the design's actual icon assets, so these are
// simplified stand-ins in the same visual language.

const SUN_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<circle cx="12" cy="12" r="4.2"/>' +
  '<line x1="12" y1="2.5" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="21.5"/>' +
  '<line x1="2.5" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="21.5" y2="12"/>' +
  '<line x1="5.1" y1="5.1" x2="6.9" y2="6.9"/><line x1="17.1" y1="17.1" x2="18.9" y2="18.9"/>' +
  '<line x1="5.1" y1="18.9" x2="6.9" y2="17.1"/><line x1="17.1" y1="6.9" x2="18.9" y2="5.1"/>' +
  "</svg>";

const CLOUD_SUN_ICON_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<circle cx="8.5" cy="7.5" r="3"/>' +
  '<path d="M5 18h11.5a3.5 3.5 0 0 0 .5-6.96A5 5 0 0 0 7.5 9.9"/>' +
  "</svg>";

const CLOUD_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M6 18h11.5a3.5 3.5 0 0 0 .5-6.96 5 5 0 0 0-9.6-1.65A4 4 0 0 0 6 18Z"/>' +
  "</svg>";

const FOG_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M6 10h11.5a3.5 3.5 0 0 0 .3-6.98"/>' +
  '<line x1="3.5" y1="14.5" x2="20.5" y2="14.5"/>' +
  '<line x1="3.5" y1="18.5" x2="20.5" y2="18.5"/>' +
  "</svg>";

const CLOUD_RAIN_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M6 13.5h11.5a3.5 3.5 0 0 0 .5-6.96 5 5 0 0 0-9.6-1.65A4 4 0 0 0 6 13.5Z"/>' +
  '<line x1="8.5" y1="17.5" x2="7.5" y2="20.5"/><line x1="12.5" y1="17.5" x2="11.5" y2="20.5"/><line x1="16.5" y1="17.5" x2="15.5" y2="20.5"/>' +
  "</svg>";

const CLOUD_SNOW_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M6 13.5h11.5a3.5 3.5 0 0 0 .5-6.96 5 5 0 0 0-9.6-1.65A4 4 0 0 0 6 13.5Z"/>' +
  '<line x1="8" y1="17" x2="8" y2="21"/><line x1="6" y1="19" x2="10" y2="19"/>' +
  '<line x1="14.5" y1="17" x2="14.5" y2="21"/><line x1="12.5" y1="19" x2="16.5" y2="19"/>' +
  "</svg>";

const CLOUD_LIGHTNING_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M6 12.5h11.5a3.5 3.5 0 0 0 .5-6.96 5 5 0 0 0-9.6-1.65A4 4 0 0 0 6 12.5Z"/>' +
  '<path d="M13 13.5 10 18h3l-2 4"/>' +
  "</svg>";

/** Maps an Open-Meteo weather_code to one of the small icon SVGs above. */
function iconForWeatherCode(code) {
  if (code === 0 || code === 1) return SUN_SVG;
  if (code === 2) return CLOUD_SUN_ICON_SVG;
  if (code === 3) return CLOUD_SVG;
  if (code === 45 || code === 48) return FOG_SVG;
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return CLOUD_RAIN_SVG;
  if ([71, 73, 75].includes(code)) return CLOUD_SNOW_SVG;
  if ([95, 96, 99].includes(code)) return CLOUD_LIGHTNING_SVG;
  return CLOUD_SVG;
}

// --- Initial view (depends on the "when the map opens" setting) ---------

function getInitialView() {
  const startLocation = Settings.get("startLocation");
  if (startLocation === "remember") {
    const last = LastView.load();
    if (last) return { center: [last.lat, last.lon], zoom: last.zoom };
  }
  return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
}

const initialView = getInitialView();
const map = L.map("map", { zoomControl: false }).setView(initialView.center, initialView.zoom);

let activeTileLayer = null;
function setBasemap(key) {
  const config = TILE_LAYERS[key] || TILE_LAYERS.standard;
  if (activeTileLayer) map.removeLayer(activeTileLayer);
  activeTileLayer = L.tileLayer(config.url, config.options).addTo(map);
}

if (Settings.get("startLocation") === "geolocate" && navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 10),
    () => {} // silently fall back to the default/remembered view
  );
}

map.on("moveend", () => {
  const center = map.getCenter();
  LastView.save(center.lat, center.lng, map.getZoom());
});

let weatherMarker = null;
let currentWeatherLocation = null; // {lat, lon, label} — used to re-render on unit/theme changes
let lastWeatherData = null; // most recent successful fetchWeather() response, for the detail panel
let weatherDetailOpen = false;
const lightningLayer = L.layerGroup().addTo(map);

const searchInput = document.getElementById("search-input");
const locateBtn = document.getElementById("locate-btn");
const statusPillEl = document.querySelector(".status-pill");
const statusDotEl = document.getElementById("status-dot");
const statusTextEl = document.getElementById("status-text");
const weatherToggle = document.getElementById("weather-toggle");
const lightningToggle = document.getElementById("lightning-toggle");
const aircraftToggle = document.getElementById("aircraft-toggle");
const themeToggleBtn = document.getElementById("theme-toggle");
const themeIconMoon = document.getElementById("theme-icon-moon");
const themeIconSun = document.getElementById("theme-icon-sun");
const zoomInBtn = document.getElementById("zoom-in-btn");
const zoomOutBtn = document.getElementById("zoom-out-btn");
const settingsBtn = document.getElementById("settings-btn");
const settingsModal = document.getElementById("settings-modal");
const settingsClose = document.getElementById("settings-close");
const settingsReset = document.getElementById("settings-reset");
const settingWindowSelect = document.getElementById("setting-window");
const settingMaxMarkersSelect = document.getElementById("setting-max-markers");
const settingStatusBadgeCheckbox = document.getElementById("setting-status-badge");
const settingUnitsSelect = document.getElementById("setting-units");
const settingStartLocationSelect = document.getElementById("setting-start-location");
const weatherDetailEl = document.getElementById("weather-detail");
const weatherDetailLocationEl = document.getElementById("weather-detail-location");
const weatherDetailDescriptionEl = document.getElementById("weather-detail-description");
const weatherDetailCloseBtn = document.getElementById("weather-detail-close");
const weatherDetailHourlyEl = document.getElementById("weather-detail-hourly");
const weatherDetailDailyEl = document.getElementById("weather-detail-daily");

const WEATHER_CODES = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

// --- Theme (drives both the UI palette and the map basemap) ---------------

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  setBasemap(theme === "dark" ? "dark" : "standard");
  const isDark = theme === "dark";
  // Note: the `hidden` IDL property doesn't reflect to the content
  // attribute on inline <svg> elements in every browser, so it silently
  // no-ops here — toggleAttribute operates on the attribute directly and
  // works consistently for both HTML and SVG elements. Paired with the
  // `svg[hidden] { display: none }` rule in style.css.
  themeIconMoon.toggleAttribute("hidden", isDark);
  themeIconSun.toggleAttribute("hidden", !isDark);
  themeToggleBtn.title = isDark ? "Switch to light theme" : "Switch to dark theme";
}
applyTheme(Settings.get("theme"));

themeToggleBtn.addEventListener("click", () => {
  const next = Settings.get("theme") === "light" ? "dark" : "light";
  Settings.set({ theme: next });
  applyTheme(next);
});

// --- Zoom controls ----------------------------------------------------------

zoomInBtn.addEventListener("click", () => map.zoomIn());
zoomOutBtn.addEventListener("click", () => map.zoomOut());

// --- Units -----------------------------------------------------------------

function getUnitConfig() {
  const imperial = Settings.get("units") === "imperial";
  return {
    temperature_unit: imperial ? "fahrenheit" : "celsius",
    wind_speed_unit: imperial ? "mph" : "kmh",
    tempSuffix: imperial ? "°F" : "°C",
    windSuffix: imperial ? "mph" : "km/h",
  };
}

async function fetchWeather(lat, lon) {
  const { temperature_unit, wind_speed_unit } = getUnitConfig();
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code` +
    `&hourly=temperature_2m,weather_code&daily=temperature_2m_max,weather_code&forecast_days=7` +
    `&temperature_unit=${temperature_unit}&wind_speed_unit=${wind_speed_unit}&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather request failed: ${res.status}`);
  return res.json();
}

async function geocodeCity(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding request failed: ${res.status}`);
  const data = await res.json();
  if (!data.results || data.results.length === 0) return null;
  const { latitude, longitude, name: resolvedName, country } = data.results[0];
  return { lat: latitude, lon: longitude, label: `${resolvedName}, ${country}` };
}

// --- Weather pin + floating badge (replaces the old side panel) -----------

function setWeatherPin(lat, lon, badgeInnerHtml) {
  const icon = L.divIcon({
    html: `<div class="map-pin-wrap">${badgeInnerHtml}${PIN_SVG}</div>`,
    className: "",
    iconSize: [200, 60],
    iconAnchor: [100, 54],
  });
  if (weatherMarker) {
    weatherMarker.setLatLng([lat, lon]);
    weatherMarker.setIcon(icon);
  } else {
    weatherMarker = L.marker([lat, lon], { icon, interactive: false }).addTo(map);
  }
}

function removeWeatherPin() {
  if (weatherMarker) {
    map.removeLayer(weatherMarker);
    weatherMarker = null;
  }
  closeWeatherDetail();
}

function renderWeatherBadge(data) {
  const c = data.current;
  const description = WEATHER_CODES[c.weather_code] ?? "Unknown";
  const { tempSuffix } = getUnitConfig();
  return `<div class="map-pin-badge">${CLOUD_SUN_SVG}<span>${Math.round(c.temperature_2m)}${tempSuffix} ${description}</span></div>`;
}

// --- Detailed weather card (top-right, opened from the pin's weather pill) -

const HOUR_LABEL_FORMAT = new Intl.DateTimeFormat("en-US", { hour: "numeric" });

/** Finds the index of "now" within data.hourly.time, using the location's own
 * UTC offset (data.utc_offset_seconds) rather than the browser's timezone, so
 * this lines up correctly for locations far from the user. */
function findHourlyNowIndex(data) {
  const offsetMs = (data.utc_offset_seconds || 0) * 1000;
  const localNowMs = Date.now() + offsetMs;
  const times = data.hourly.time;
  for (let i = times.length - 1; i >= 0; i--) {
    // Open-Meteo's "timezone=auto" hourly.time strings are already in local
    // time for the location and have no trailing "Z", so Date.parse reads
    // them as if they were UTC — which lines up with our offset-shifted "now".
    if (Date.parse(times[i]) <= localNowMs) return i;
  }
  return 0;
}

function renderWeatherDetail(data, label) {
  const { tempSuffix } = getUnitConfig();
  const c = data.current;
  weatherDetailLocationEl.textContent = label || "Selected location";
  weatherDetailDescriptionEl.textContent =
    `${Math.round(c.temperature_2m)}${tempSuffix} · ${WEATHER_CODES[c.weather_code] ?? "Unknown"}`;

  weatherDetailHourlyEl.innerHTML = "";
  if (data.hourly) {
    const startIdx = findHourlyNowIndex(data);
    for (let i = startIdx; i < Math.min(startIdx + 6, data.hourly.time.length); i++) {
      const isNow = i === startIdx;
      const label = isNow ? "Now" : HOUR_LABEL_FORMAT.format(new Date(data.hourly.time[i])).replace(/\s/g, "").toLowerCase();
      const temp = Math.round(data.hourly.temperature_2m[i]);
      const icon = iconForWeatherCode(data.hourly.weather_code[i]);
      weatherDetailHourlyEl.insertAdjacentHTML(
        "beforeend",
        `<div class="weather-detail-item${isNow ? " weather-detail-item--now" : ""}">
          <span class="weather-detail-item-label">${label}</span>
          <span class="weather-detail-item-top">${icon}</span>
          <span class="weather-detail-badge">${temp}°</span>
        </div>`
      );
    }
  }

  weatherDetailDailyEl.innerHTML = "";
  if (data.daily) {
    for (let i = 0; i < data.daily.time.length; i++) {
      // data.daily.time entries are plain "YYYY-MM-DD" dates with no time
      // component — the ECMAScript date parser treats those as UTC midnight,
      // which can roll over to the wrong weekday once formatted in the
      // browser's own local timezone. Parsing the parts manually into a
      // local-midnight Date avoids that shift.
      const [y, m, d] = data.daily.time[i].split("-").map(Number);
      const label = i === 0 ? "Today" : new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short" });
      const temp = Math.round(data.daily.temperature_2m_max[i]);
      const icon = iconForWeatherCode(data.daily.weather_code[i]);
      weatherDetailDailyEl.insertAdjacentHTML(
        "beforeend",
        `<div class="weather-detail-item">
          <span class="weather-detail-item-label">${label}</span>
          <span class="weather-detail-item-top">${icon}</span>
          <span class="weather-detail-badge">${temp}°</span>
        </div>`
      );
    }
  }
}

function openWeatherDetail() {
  if (!lastWeatherData) return;
  weatherDetailOpen = true;
  renderWeatherDetail(lastWeatherData, currentWeatherLocation && currentWeatherLocation.label);
  weatherDetailEl.hidden = false;
}

function closeWeatherDetail() {
  weatherDetailOpen = false;
  weatherDetailEl.hidden = true;
}

async function showWeatherAt(lat, lon, label) {
  currentWeatherLocation = { lat, lon, label };
  if (!Settings.get("weatherVisible")) return;

  setWeatherPin(lat, lon, `<div class="map-pin-badge"><span>Loading…</span></div>`);

  try {
    const data = await fetchWeather(lat, lon);
    lastWeatherData = data;
    setWeatherPin(lat, lon, renderWeatherBadge(data));
    if (weatherDetailOpen) renderWeatherDetail(data, label);
  } catch (err) {
    setWeatherPin(lat, lon, `<div class="map-pin-badge"><span>Couldn't load weather</span></div>`);
  }
}

map.on("click", (e) => {
  showWeatherAt(e.latlng.lat, e.latlng.lng);
});

// Clicking the weather pill should open the detail card instead of moving
// the pin. A capture-phase listener on the map container runs before
// Leaflet's own (bubble-phase) click handler reaches it, so stopping
// propagation here reliably prevents that handler from ever firing.
document.getElementById("map").addEventListener(
  "click",
  (e) => {
    if (e.target.closest(".map-pin-badge")) {
      e.stopPropagation();
      openWeatherDetail();
    }
  },
  true
);

weatherDetailCloseBtn.addEventListener("click", () => {
  removeWeatherPin();
  currentWeatherLocation = null;
  lastWeatherData = null;
});

// --- Live lightning feed (Blitzortung.org) -------------------------------
// See js/lightning.js for the feed itself. Strikes arrive one at a time in
// real time; we keep a short rolling buffer so panning/zooming and periodic
// pruning can redraw what's currently in view without re-fetching anything.
// The strike buffer keeps collecting in the background even when the
// "Lightning" toggle is off, so turning it back on shows up-to-date data
// immediately rather than an empty map.

let recentStrikes = [];
let renderedMarkers = []; // [{ marker, timestamp }] currently on the map, oldest first

function strikeInBounds(strike, bounds) {
  return bounds.contains([strike.lat, strike.lon]);
}

function clearRenderedMarkers() {
  renderedMarkers.forEach(({ marker }) => lightningLayer.removeLayer(marker));
  renderedMarkers = [];
}

function addStrikeMarker(strike) {
  const marker = L.circleMarker([strike.lat, strike.lon], {
    radius: 5,
    color: "#f59e0b",
    fillColor: "#f59e0b",
    fillOpacity: 1,
    weight: 0,
  })
    .bindPopup(`Lightning strike — ${formatStrikeAge(strike.timestamp)}`)
    .addTo(lightningLayer);

  renderedMarkers.push({ marker, timestamp: strike.timestamp });

  const maxMarkers = Settings.get("lightningMaxMarkers");
  if (maxMarkers > 0) {
    while (renderedMarkers.length > maxMarkers) {
      const oldest = renderedMarkers.shift();
      lightningLayer.removeLayer(oldest.marker);
    }
  }
}

/**
 * A strike's thunder doesn't arrive everywhere at once — it propagates
 * outward from the strike location and fades with distance. This animates
 * that: an expanding ring (real-world radius in metres, so it scales
 * correctly with zoom) that grows and fades once, then disappears, leaving
 * just the plain strike dot behind (added separately via addStrikeMarker).
 *
 * The ring's radius grows at the real physical speed of sound, in metres
 * per second of real time — since it's drawn with a real-world-metre
 * L.circle, Leaflet converts that to screen pixels itself, so the same
 * physical growth rate naturally animates faster on screen when zoomed in
 * and slower when zoomed out, without any manual zoom-based scaling.
 *
 * Above a certain zoom level (zoomed in close) a real-world 22km ring would
 * balloon far past the edges of the viewport almost immediately and just
 * look broken, so the animation only plays at or below a reasonable zoom
 * level; above it, only the static strike dot is shown.
 */
const SPEED_OF_SOUND_MPS = 343; // dry air at ~20°C
const MAX_RADIUS_M = 22000; // roughly how far thunder can carry on a calm day
const SOUND_WAVE_MAX_ZOOM = 11;

function animateSoundWave(lat, lon, startDelayMs) {
  setTimeout(() => {
    if (map.getZoom() > SOUND_WAVE_MAX_ZOOM) return;

    const ring = L.circle([lat, lon], {
      radius: 1,
      color: "#f59e0b",
      weight: 1.5,
      fill: false,
      opacity: 0.55,
      interactive: false,
    }).addTo(lightningLayer);

    const start = performance.now();
    function tick(now) {
      const elapsedSeconds = (now - start) / 1000;
      const radius = Math.min(MAX_RADIUS_M, SPEED_OF_SOUND_MPS * elapsedSeconds);
      const t = radius / MAX_RADIUS_M; // physical progress, 0..1 — linear, not eased
      ring.setRadius(radius);
      ring.setStyle({ opacity: 0.55 * (1 - t) });
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        lightningLayer.removeLayer(ring);
      }
    }
    requestAnimationFrame(tick);
  }, startDelayMs);
}

function redrawLightning() {
  clearRenderedMarkers();
  if (!Settings.get("lightningVisible")) return;

  const bounds = map.getBounds();
  const maxMarkers = Settings.get("lightningMaxMarkers");
  let visible = recentStrikes.filter((s) => strikeInBounds(s, bounds)).sort((a, b) => a.timestamp - b.timestamp);
  if (maxMarkers > 0 && visible.length > maxMarkers) {
    visible = visible.slice(visible.length - maxMarkers);
  }
  visible.forEach(addStrikeMarker);
}

function pruneOldStrikes() {
  const windowMs = Settings.get("lightningWindowMinutes") * 60 * 1000;
  const cutoff = Date.now() - windowMs;
  recentStrikes = recentStrikes.filter((s) => s.timestamp >= cutoff);
}

// --- Live status pill --------------------------------------------------

let lastLiveUpdateAt = Date.now();

function updateStatusText() {
  const status = LightningFeed.getStatus();
  if (status === "connected") {
    const seconds = Math.max(0, Math.round((Date.now() - lastLiveUpdateAt) / 1000));
    statusTextEl.textContent = `Live · updated ${seconds}s ago`;
  } else if (status === "connecting") {
    statusTextEl.textContent = "Partial connection";
  } else {
    statusTextEl.textContent = "Disconnected";
  }
}

function updateLightningStatus(status) {
  statusDotEl.className = `status-dot status-${status}`;
  if (status === "connected") lastLiveUpdateAt = Date.now();
  updateStatusText();
}

LightningFeed.onStatusChange(updateLightningStatus);
setInterval(updateStatusText, 1000);

LightningFeed.onStrike((strike) => {
  recentStrikes.push(strike);
  if (recentStrikes.length > 5000) recentStrikes.shift(); // hard cap, just in case
  lastLiveUpdateAt = Date.now();
  if (Settings.get("lightningVisible") && strikeInBounds(strike, map.getBounds())) {
    addStrikeMarker(strike);
    animateSoundWave(strike.lat, strike.lon, 0);
  }
});

map.on("moveend", redrawLightning);
setInterval(() => {
  pruneOldStrikes();
  redrawLightning();
}, 30 * 1000);

LightningFeed.connect();

// --- Search / geolocation --------------------------------------------------

async function runSearch() {
  const query = searchInput.value.trim();
  if (!query) return;
  try {
    const result = await geocodeCity(query);
    if (!result) return;
    map.setView([result.lat, result.lon], 9);
    showWeatherAt(result.lat, result.lon, result.label);
  } catch (err) {
    // Silently ignore — there's no side panel to report this in any more;
    // the search box itself just won't move the map.
  }
}

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runSearch();
});

locateBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      map.setView([latitude, longitude], 10);
      showWeatherAt(latitude, longitude, "Your location");
    },
    () => {
      alert("Could not get your location.");
    }
  );
});

// --- Core toggles: Weather / Lightning / Aircraft ---------------------------

function setTogglePressed(button, pressed) {
  button.setAttribute("aria-pressed", String(pressed));
}

setTogglePressed(weatherToggle, Settings.get("weatherVisible"));
weatherToggle.addEventListener("click", () => {
  const next = !(Settings.get("weatherVisible"));
  Settings.set({ weatherVisible: next });
  setTogglePressed(weatherToggle, next);
  if (!next) {
    removeWeatherPin();
  } else if (currentWeatherLocation) {
    showWeatherAt(currentWeatherLocation.lat, currentWeatherLocation.lon, currentWeatherLocation.label);
  }
});

setTogglePressed(lightningToggle, Settings.get("lightningVisible"));
lightningToggle.addEventListener("click", () => {
  const next = !(Settings.get("lightningVisible"));
  Settings.set({ lightningVisible: next });
  setTogglePressed(lightningToggle, next);
  redrawLightning();
});

// Aircraft: a real, persisted toggle that matches the design — there's no
// live flight-data source wired up yet (see project notes), so this simply
// doesn't render anything either way.
setTogglePressed(aircraftToggle, Settings.get("aircraftVisible"));
aircraftToggle.addEventListener("click", () => {
  const next = !(Settings.get("aircraftVisible"));
  Settings.set({ aircraftVisible: next });
  setTogglePressed(aircraftToggle, next);
});

// --- Settings modal ----------------------------------------------------

function openSettingsModal() {
  settingsModal.hidden = false;
}
function closeSettingsModal() {
  settingsModal.hidden = true;
}

settingsBtn.addEventListener("click", openSettingsModal);
settingsClose.addEventListener("click", closeSettingsModal);
settingsModal.addEventListener("click", (e) => {
  if (e.target === settingsModal) closeSettingsModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !settingsModal.hidden) closeSettingsModal();
});

function syncSettingsFormFromState() {
  settingWindowSelect.value = String(Settings.get("lightningWindowMinutes"));
  settingMaxMarkersSelect.value = String(Settings.get("lightningMaxMarkers"));
  settingStatusBadgeCheckbox.checked = Settings.get("showStatusBadge");
  settingUnitsSelect.value = Settings.get("units");
  settingStartLocationSelect.value = Settings.get("startLocation");
  statusPillEl.style.display = Settings.get("showStatusBadge") ? "" : "none";
}
syncSettingsFormFromState();

settingWindowSelect.addEventListener("change", () => {
  Settings.set({ lightningWindowMinutes: Number(settingWindowSelect.value) });
  pruneOldStrikes();
  redrawLightning();
});

settingMaxMarkersSelect.addEventListener("change", () => {
  Settings.set({ lightningMaxMarkers: Number(settingMaxMarkersSelect.value) });
  redrawLightning();
});

settingStatusBadgeCheckbox.addEventListener("change", () => {
  Settings.set({ showStatusBadge: settingStatusBadgeCheckbox.checked });
  statusPillEl.style.display = settingStatusBadgeCheckbox.checked ? "" : "none";
});

settingUnitsSelect.addEventListener("change", () => {
  Settings.set({ units: settingUnitsSelect.value });
  if (currentWeatherLocation) {
    showWeatherAt(currentWeatherLocation.lat, currentWeatherLocation.lon, currentWeatherLocation.label);
  }
});

settingStartLocationSelect.addEventListener("change", () => {
  Settings.set({ startLocation: settingStartLocationSelect.value });
});

settingsReset.addEventListener("click", () => {
  Settings.reset();
  setTogglePressed(weatherToggle, Settings.get("weatherVisible"));
  setTogglePressed(lightningToggle, Settings.get("lightningVisible"));
  setTogglePressed(aircraftToggle, Settings.get("aircraftVisible"));
  applyTheme(Settings.get("theme"));
  syncSettingsFormFromState();
  pruneOldStrikes();
  redrawLightning();
  if (currentWeatherLocation) {
    showWeatherAt(currentWeatherLocation.lat, currentWeatherLocation.lon, currentWeatherLocation.label);
  }
});
