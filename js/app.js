/**
 * Weather & Lightning Map — main app logic.
 * Map: Leaflet + OpenStreetMap tiles.
 * Weather: Open-Meteo (https://open-meteo.com/) — free, no API key required.
 * Lightning: live feed from Blitzortung.org, see js/lightning.js.
 */

const map = L.map("map", { zoomControl: true }).setView([51.505, -0.09], 6); // London default

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

let weatherMarker = null;
const lightningLayer = L.layerGroup().addTo(map);

const panelContent = document.getElementById("panel-content");
const searchInput = document.getElementById("search-input");
const searchBtn = document.getElementById("search-btn");
const locateBtn = document.getElementById("locate-btn");
const lightningStatusEl = document.getElementById("lightning-status");

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

async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`;
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

  panelContent.innerHTML = `
    <h2>${label}</h2>
    <div class="weather-row"><span>Conditions</span><span>${description}</span></div>
    <div class="weather-row"><span>Temperature</span><span>${c.temperature_2m}&deg;C</span></div>
    <div class="weather-row"><span>Feels like</span><span>${c.apparent_temperature}&deg;C</span></div>
    <div class="weather-row"><span>Humidity</span><span>${c.relative_humidity_2m}%</span></div>
    <div class="weather-row"><span>Wind speed</span><span>${c.wind_speed_10m} km/h</span></div>
  `;
}

async function showWeatherAt(lat, lon, label) {
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

const LIGHTNING_MAX_AGE_MS = 20 * 60 * 1000; // keep strikes for 20 minutes
let recentStrikes = [];

function strikeInBounds(strike, bounds) {
  return bounds.contains([strike.lat, strike.lon]);
}

function addStrikeMarker(strike) {
  L.circleMarker([strike.lat, strike.lon], {
    radius: 6,
    color: "#fbbf24",
    fillColor: "#fbbf24",
    fillOpacity: 0.8,
    weight: 1,
  })
    .bindPopup(`Lightning strike — ${formatStrikeAge(strike.timestamp)}`)
    .addTo(lightningLayer);
}

function redrawLightning() {
  const bounds = map.getBounds();
  lightningLayer.clearLayers();
  recentStrikes.filter((s) => strikeInBounds(s, bounds)).forEach(addStrikeMarker);
}

function pruneOldStrikes() {
  const cutoff = Date.now() - LIGHTNING_MAX_AGE_MS;
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
  if (strikeInBounds(strike, map.getBounds())) {
    addStrikeMarker(strike);
  }
});

map.on("moveend", redrawLightning);
setInterval(() => {
  pruneOldStrikes();
  redrawLightning();
}, 30 * 1000);

LightningFeed.connect();

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
