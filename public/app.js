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
const TEMPERATURE_DECIMALS = 1;
const ELECTRIC_DECIMALS = 2;
const MILLI_PER_UNIT = 1000;
const NO_VALUE = "—";

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

function renderFleet(fleet) {
  byId("fleet").replaceChildren(
    stat("total", fleet.total),
    stat("online", fleet.online),
    stat("ok", fleet.ok, "ok"),
    stat("warn", fleet.warn, "warn"),
    stat("crit", fleet.crit, "crit"),
    stat("offline", fleet.offline, "offline"),
  );
}

function listOrEmpty(list, items, emptyText) {
  list.replaceChildren(...(items.length > 0 ? items : [element("li", "empty", emptyText)]));
}

function alertItem(alert) {
  const item = element("li", "alert");
  item.append(
    element("span", "device-id", `#${alert.deviceId}`),
    element("span", "grow", alert.label),
    element("span", "value", `${Math.floor(alert.durationMs / MS_PER_SECOND)} s`),
  );
  return item;
}

function renderAlerts(alerts) {
  byId("alert-count").textContent = String(alerts.length);
  listOrEmpty(byId("alerts"), alerts.map(alertItem), "No active alerts");
}

function formatReading(value, decimals, unit) {
  return value === null ? NO_VALUE : `${value.toFixed(decimals)} ${unit}`;
}

function formatTemperature(temperatureC) {
  return formatReading(temperatureC, TEMPERATURE_DECIMALS, "°C");
}

function formatMilli(milli, unit) {
  return formatReading(milli === null ? null : milli / MILLI_PER_UNIT, ELECTRIC_DECIMALS, unit);
}

function hottestItem(device) {
  const item = element("li", `status-${device.status.toLowerCase()}`);
  item.append(
    element("span", "device-id", `#${device.deviceId}`),
    element("span", "grow card-status", device.status),
    element("span", "value", formatTemperature(device.temperatureC)),
  );
  return item;
}

function renderHottest(hottest) {
  listOrEmpty(byId("hottest"), hottest.map(hottestItem), "No readings yet");
}

function deviceCard(device, generatedAt) {
  const card = element("article", `card status-${device.status.toLowerCase()}`);
  const head = element("div", "card-head");
  head.append(element("span", "", `#${device.deviceId}`), element("span", "card-status", device.status));
  card.append(
    head,
    element("div", "card-temp", formatTemperature(device.temperatureC)),
    element("div", "card-line", `${formatMilli(device.voltageMv, "V")} · ${formatMilli(device.currentMa, "A")}`),
    element("div", "card-line", `seen ${formatDuration(generatedAt - device.lastSeenMs)} ago`),
    element("div", "card-line", `lost ${device.lost} · dup ${device.duplicates} · late ${device.late} · reboots ${device.reboots}`),
  );
  return card;
}

function renderDevices(snapshot) {
  const cards = snapshot.devices.map((device) => deviceCard(device, snapshot.generatedAt));
  byId("devices").replaceChildren(...(cards.length > 0 ? cards : [element("p", "card-line", "Waiting for devices")]));
}

function render(snapshot) {
  renderReception(snapshot);
  renderFleet(snapshot.fleet);
  renderAlerts(snapshot.alerts);
  renderHottest(snapshot.hottest);
  renderDevices(snapshot);
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
