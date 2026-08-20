/**
 * Weather & Lightning Map — main app logic.
 * Map: Leaflet + OpenStreetMap/CARTO tiles.
 * Weather: Open-Meteo (https://open-meteo.com/) — free, no API key required.
 * Lightning: live feed from Blitzortung.org, see js/lightning.js.
 * Settings: see js/settings.js — core toggles live in the header, everything
 * else lives behind the gear icon.
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
const map = L.map("map", { zoomControl: true }).setView(initialView.center, initialView.zoom);

let activeTileLayer = null;
function setBasemap(key) {
  const config = TILE_LAYERS[key] || TILE_LAYERS.standard;
  if (activeTileLayer) map.removeLayer(activeTileLayer);
  activeTileLayer = L.tileLayer(config.url, config.options).addTo(map);
}
setBasemap(Settings.get("basemap"));

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
let currentWeatherLocation = null; // {lat, lon, label} — used to re-render on unit changes
const lightningLayer = L.layerGroup().addTo(map);

const panelContent = document.getElementById("panel-content");
const searchInput = document.getElementById("search-input");
const searchBtn = document.getElementById("search-btn");
const locateBtn = document.getElementById("locate-btn");
const lightningStatusEl = document.getElementById("lightning-status");
const lightningToggle = document.getElementById("lightning-toggle");
const unitsToggleBtn = document.getElementById("units-toggle");
const settingsBtn = document.getElementById("settings-btn");
const settingsModal = document.getElementById("settings-modal");
const settingsClose = document.getElementById("settings-close");
const settingsReset = document.getElementById("settings-reset");
const settingWindowSelect = document.getElementById("setting-window");
const settingMaxMarkersSelect = document.getElementById("setting-max-markers");
const settingStatusBadgeCheckbox = document.getElementById("setting-status-badge");
const settingBasemapSelect = document.getElementById("setting-basemap");
const settingStartLocationSelect = document.getElementById("setting-start-location");

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

function updateUnitsButtonLabel() {
  const { tempSuffix, windSuffix } = getUnitConfig();
  unitsToggleBtn.textContent = `${tempSuffix} · ${windSuffix}`;
}

async function fetchWeather(lat, lon) {
  const { temperature_unit, wind_speed_unit } = getUnitConfig();
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code` +
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

function renderWeatherPanel(label, data) {
  const c = data.current;
  const description = WEATHER_CODES[c.weather_code] ?? "Unknown conditions";
  const { tempSuffix, windSuffix } = getUnitConfig();

  panelContent.innerHTML = `
    <h2>${label}</h2>
    <div class="weather-row"><span>Conditions</span><span>${description}</span></div>
    <div class="weather-row"><span>Temperature</span><span>${c.temperature_2m}${tempSuffix}</span></div>
    <div class="weather-row"><span>Feels like</span><span>${c.apparent_temperature}${tempSuffix}</span></div>
    <div class="weather-row"><span>Humidity</span><span>${c.relative_humidity_2m}%</span></div>
    <div class="weather-row"><span>Wind speed</span><span>${c.wind_speed_10m} ${windSuffix}</span></div>
  `;
}

async function showWeatherAt(lat, lon, label) {
  currentWeatherLocation = { lat, lon, label };

  if (weatherMarker) {
    map.removeLayer(weatherMarker);
  }
  weatherMarker = L.marker([lat, lon]).addTo(map);

  panelContent.innerHTML = `<p class="hint">Loading weather...</p>`;

  try {
    const data = await fetchWeather(lat, lon);
    renderWeatherPanel(label ?? `${lat.toFixed(2)}, ${lon.toFixed(2)}`, data);
  } catch (err) {
    panelContent.innerHTML = `<p class="hint">Couldn't load weather: ${err.message}</p>`;
  }
}

map.on("click", (e) => {
  showWeatherAt(e.latlng.lat, e.latlng.lng);
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
    radius: 6,
    color: "#fbbf24",
    fillColor: "#fbbf24",
    fillOpacity: 0.8,
    weight: 1,
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

function updateLightningStatus(status) {
  if (!lightningStatusEl) return;
  lightningStatusEl.textContent =
    status === "connected" ? "live" : status === "connecting" ? "connecting…" : "reconnecting…";
  lightningStatusEl.className = `status-badge status-${status}`;
}

LightningFeed.onStatusChange(updateLightningStatus);

LightningFeed.onStrike((strike) => {
  recentStrikes.push(strike);
  if (recentStrikes.length > 5000) recentStrikes.shift(); // hard cap, just in case
  if (Settings.get("lightningVisible") && strikeInBounds(strike, map.getBounds())) {
    addStrikeMarker(strike);
  }
});

map.on("moveend", redrawLightning);
setInterval(() => {
  pruneOldStrikes();
  redrawLightning();
}, 30 * 1000);

LightningFeed.connect();

// --- Search / geolocation --------------------------------------------------

searchBtn.addEventListener("click", async () => {
  const query = searchInput.value.trim();
  if (!query) return;
  panelContent.innerHTML = `<p class="hint">Searching...</p>`;
  try {
    const result = await geocodeCity(query);
    if (!result) {
      panelContent.innerHTML = `<p class="hint">No results for "${query}".</p>`;
      return;
    }
    map.setView([result.lat, result.lon], 9);
    showWeatherAt(result.lat, result.lon, result.label);
  } catch (err) {
    panelContent.innerHTML = `<p class="hint">Search failed: ${err.message}</p>`;
  }
});

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchBtn.click();
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

// --- Core toggle: lightning on/off -----------------------------------------

lightningToggle.checked = Settings.get("lightningVisible");
lightningToggle.addEventListener("change", () => {
  Settings.set({ lightningVisible: lightningToggle.checked });
  redrawLightning();
});

// --- Core toggle: units ------------------------------------------------

updateUnitsButtonLabel();
unitsToggleBtn.addEventListener("click", () => {
  const next = Settings.get("units") === "metric" ? "imperial" : "metric";
  Settings.set({ units: next });
  updateUnitsButtonLabel();
  if (currentWeatherLocation) {
    showWeatherAt(currentWeatherLocation.lat, currentWeatherLocation.lon, currentWeatherLocation.label);
  }
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
  settingBasemapSelect.value = Settings.get("basemap");
  settingStartLocationSelect.value = Settings.get("startLocation");
  lightningStatusEl.style.display = Settings.get("showStatusBadge") ? "" : "none";
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
  lightningStatusEl.style.display = settingStatusBadgeCheckbox.checked ? "" : "none";
});

settingBasemapSelect.addEventListener("change", () => {
  Settings.set({ basemap: settingBasemapSelect.value });
  setBasemap(settingBasemapSelect.value);
});

settingStartLocationSelect.addEventListener("change", () => {
  Settings.set({ startLocation: settingStartLocationSelect.value });
});

settingsReset.addEventListener("click", () => {
  Settings.reset();
  lightningToggle.checked = Settings.get("lightningVisible");
  updateUnitsButtonLabel();
  syncSettingsFormFromState();
  setBasemap(Settings.get("basemap"));
  pruneOldStrikes();
  redrawLightning();
  if (currentWeatherLocation) {
    showWeatherAt(currentWeatherLocation.lat, currentWeatherLocation.lon, currentWeatherLocation.label);
  }
});
