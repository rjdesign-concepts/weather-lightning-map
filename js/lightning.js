/**
 * Lightning data layer.
 *
 * There is no free, key-less, production-grade global lightning API, so this
 * module ships with a SIMULATED strike generator that scatters plausible
 * "recent strikes" around whatever map bounds are currently visible. It's
 * wired up so swapping in a real feed later only means replacing
 * `fetchLightningStrikes()`.
 *
 * To hook up a real feed, options include:
 *  - Blitzortung.org community network (unofficial WebSocket feeds exist,
 *    e.g. via third-party bridges — check current ToS before using).
 *  - A commercial provider such as Vaisala Xweather or Spire, which offer
 *    paid APIs with proper SLAs.
 *
 * Replace the body of fetchLightningStrikes() with a real fetch()/WebSocket
 * call that resolves to an array of { lat, lon, timestamp } objects.
 */

async function fetchLightningStrikes(bounds) {
  const { north, south, east, west } = bounds;
  const strikeCount = Math.floor(Math.random() * 6); // 0-5 simulated strikes
  const strikes = [];

  for (let i = 0; i < strikeCount; i++) {
    strikes.push({
      lat: south + Math.random() * (north - south),
      lon: west + Math.random() * (east - west),
      timestamp: Date.now() - Math.floor(Math.random() * 60 * 60 * 1000), // last hour
    });
  }

  return strikes;
}

function formatStrikeAge(timestamp) {
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 min ago";
  return `${minutes} min ago`;
}
