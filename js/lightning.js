/**
 * Lightning data layer — LIVE data from Blitzortung.org's community lightning
 * detection network (https://www.blitzortung.org/), via the same public,
 * unauthenticated WebSocket feed their own live map uses.
 *
 * Usage terms (see https://www.blitzortung.org/en/contact.php — data is
 * offered under CC BY-SA 4.0):
 *  - Personal / non-commercial / entertainment use only. Blitzortung
 *    explicitly disallows using this data for storm warning systems,
 *    damage/plausibility checks, or risk analysis.
 *  - Attribute Blitzortung.org as the data source (see the footer/legend
 *    in index.html).
 *  - Be a good citizen: this module opens exactly ONE WebSocket connection
 *    and reconnects with exponential backoff — never a tight retry loop or
 *    multiple simultaneous connections.
 *
 * Protocol notes: Blitzortung has no official public REST API. Their live
 * map talks to one of several mirror WebSocket servers (wss://ws1, ws7,
 * ws8, ...).blitzortung.org) and streams LZW-compressed JSON strike
 * records. This has been reverse-engineered by several independent
 * open-source projects (see README for links) and matches across all of
 * them, but it is UNOFFICIAL and may break if Blitzortung changes their
 * protocol.
 */

const BLITZORTUNG_SERVER_IDS = ["ws1", "ws7", "ws8"];
const RECONNECT_BASE_DELAY_MS = 2000;
const RECONNECT_MAX_DELAY_MS = 60000;

const strikeListeners = new Set();
const statusListeners = new Set();

let socket = null;
let reconnectAttempt = 0;
let reconnectTimer = null;
let connectionStatus = "disconnected"; // "connecting" | "connected" | "disconnected"

function setStatus(status) {
  connectionStatus = status;
  statusListeners.forEach((cb) => cb(status));
}

/**
 * Reverse-engineered LZW decompressor used by Blitzortung's live feed.
 * Incoming WebSocket text frames are LZW-compressed and must be run through
 * this before JSON.parse. Matches multiple independent open-source clients
 * (see README).
 */
function lzwDecode(input) {
  const dictionary = {};
  const data = input.split("");
  let currentChar = data[0];
  let oldPhrase = currentChar;
  const output = [currentChar];
  let code = 256;

  for (let i = 1; i < data.length; i++) {
    const currentCode = data[i].charCodeAt(0);
    let phrase;
    if (currentCode < 256) {
      phrase = data[i];
    } else {
      phrase = dictionary[currentCode] ? dictionary[currentCode] : oldPhrase + currentChar;
    }
    output.push(phrase);
    currentChar = phrase.charAt(0);
    dictionary[code] = oldPhrase + currentChar;
    code++;
    oldPhrase = phrase;
  }
  return output.join("");
}

function pickServerUrl() {
  const id = BLITZORTUNG_SERVER_IDS[Math.floor(Math.random() * BLITZORTUNG_SERVER_IDS.length)];
  return `wss://${id}.blitzortung.org/`;
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempt, RECONNECT_MAX_DELAY_MS);
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(openConnection, delay);
}

function openConnection() {
  setStatus("connecting");

  let ws;
  try {
    ws = new WebSocket(pickServerUrl());
  } catch (err) {
    scheduleReconnect();
    return;
  }
  socket = ws;

  ws.onopen = () => {
    reconnectAttempt = 0;
    setStatus("connected");
    // A small JSON handshake frame is required to start the stream. The
    // server doesn't appear to validate its contents (several independent
    // open-source clients use different values here and all work).
    ws.send(JSON.stringify({ a: 111 }));
  };

  ws.onmessage = (event) => {
    try {
      const decoded = lzwDecode(event.data);
      const raw = JSON.parse(decoded);
      if (typeof raw.lat !== "number" || typeof raw.lon !== "number" || typeof raw.time !== "number") {
        return;
      }

      const strike = {
        lat: raw.lat,
        lon: raw.lon,
        timestamp: Math.floor(raw.time / 1e6), // nanoseconds -> milliseconds
      };
      strikeListeners.forEach((cb) => cb(strike));
    } catch (err) {
      // Malformed/unexpected frame — ignore it and keep the connection alive.
    }
  };

  ws.onerror = () => {
    ws.close();
  };

  ws.onclose = () => {
    if (socket === ws) {
      setStatus("disconnected");
      scheduleReconnect();
    }
  };
}

const LightningFeed = {
  /** Open the (single) live connection. Safe to call more than once. */
  connect() {
    if (socket) return;
    openConnection();
  },
  /** Register a callback for each decoded strike: ({lat, lon, timestamp}) => void */
  onStrike(callback) {
    strikeListeners.add(callback);
    return () => strikeListeners.delete(callback);
  },
  /** Register a callback for connection status changes: (status) => void */
  onStatusChange(callback) {
    statusListeners.add(callback);
    callback(connectionStatus);
    return () => statusListeners.delete(callback);
  },
  getStatus() {
    return connectionStatus;
  },
};

function formatStrikeAge(timestamp) {
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 min ago";
  return `${minutes} min ago`;
}
