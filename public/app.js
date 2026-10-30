const DECODE_ERROR_REASONS = [
  "TOO_SHORT",
  "TOO_LONG",
  "BAD_MAGIC",
  "BAD_VERSION",
  "LENGTH_MISMATCH",
  "BAD_CHECKSUM",
  "UNKNOWN_TYPE",
  "INVALID_DEVICE_ID",
  "HEARTBEAT_WITH_MEASUREMENTS",
];
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const RATE_DECIMALS = 1;

function byId(id) {
  return document.getElementById(id);
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / MS_PER_SECOND);
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function stat(label, value, tone) {
  const tile = element("div", tone ? `stat tone-${tone}` : "stat");
  tile.append(element("span", "stat-value", String(value)), element("span", "stat-label", label));
  return tile;
}

function reasonsOf(invalidByReason) {
  return [...new Set([...DECODE_ERROR_REASONS, ...Object.keys(invalidByReason)])];
}

function reasonTile(reason, count) {
  const tile = stat(reason, count);
  tile.classList.toggle("nonzero", count > 0);
  return tile;
}

function renderReception(snapshot) {
  const reception = snapshot.reception;
  const badge = byId("health");
  badge.textContent = reception.health;
  badge.className = `badge level-${reception.health.toLowerCase()}`;
  byId("uptime").textContent = formatDuration(snapshot.hubUptimeMs);
  byId("reception-stats").replaceChildren(
    stat("frames/s", reception.framesPerSecond.toFixed(RATE_DECIMALS)),
    stat("received", reception.received),
    stat("valid", reception.valid),
    stat("invalid", reception.invalid),
    stat("accepted", reception.accepted),
    stat("duplicates", reception.duplicates),
    stat("late", reception.late),
    stat("lost", reception.lost),
    stat("loss %", reception.lossRatePct.toFixed(RATE_DECIMALS)),
    stat("invalid %", reception.invalidRatePct.toFixed(RATE_DECIMALS)),
  );
  byId("invalid-reasons").replaceChildren(
    ...reasonsOf(reception.invalidByReason).map((reason) => reasonTile(reason, reception.invalidByReason[reason] ?? 0)),
  );
}

function render(snapshot) {
  renderReception(snapshot);
}

function setConnection(live) {
  const indicator = byId("connection");
  indicator.textContent = live ? "LIVE" : "RECONNECTING";
  indicator.className = `connection ${live ? "live" : "lost"}`;
}

function connect() {
  const source = new EventSource("/events");
  source.onopen = () => setConnection(true);
  source.onerror = () => setConnection(false);
  source.onmessage = (event) => {
    setConnection(true);
    render(JSON.parse(event.data));
  };
}

connect();
