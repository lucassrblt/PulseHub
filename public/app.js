const METER_MAX_C = 90;
const METER_STEP_C = 5;
const TEMP_WARN_C = 60;
const TEMP_CRIT_C = 70;
const MAX_TILT_STEPS = 2;
const TILT_DEG_PER_STEP = 0.5;
const TILT_SPREAD = 37;
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const MILLI_PER_UNIT = 1000;
const NO_VALUE = "–";
const STATUSES = ["OK", "WARN", "CRIT", "OFFLINE"];
const STATUS_WORDS = { OK: "normal", WARN: "à surveiller", CRIT: "critique", OFFLINE: "hors ligne" };
const ALERT_LABELS = {
  "temperature-critical": "Surchauffe",
  "voltage-out-of-range": "Tension hors plage",
  overcurrent: "Surintensité",
};
const REASON_LABELS = {
  TOO_SHORT: "Trame trop courte",
  TOO_LONG: "Trame trop longue",
  BAD_MAGIC: "Signature inconnue",
  BAD_VERSION: "Version non prise en charge",
  LENGTH_MISMATCH: "Longueur incohérente",
  BAD_CHECKSUM: "Checksum faux",
  UNKNOWN_TYPE: "Type de trame inconnu",
  INVALID_DEVICE_ID: "Identifiant d’appareil invalide",
  HEARTBEAT_WITH_MEASUREMENTS: "Battement avec mesures",
};
const FIGURES = [
  ["framesPerSecond", "Trames par seconde", 1],
  ["received", "Reçues", 0],
  ["lost", "Perdues", 0],
  ["duplicates", "Doublons", 0],
  ["late", "En retard", 0],
  ["invalid", "Invalides", 0],
];
const DETAIL_FIELDS = [
  ["Température", (device) => celsius(device.temperatureC)],
  ["Tension", (device) => milli(device.voltageMv, "V")],
  ["Courant", (device) => milli(device.currentMa, "A")],
  ["Vu il y a", (device, now) => duration(now - number(device.lastSeenMs))],
  ["En marche depuis", (device) => duration(device.uptimeMs)],
  ["Dernière séquence", (device) => count(device.lastSeq)],
  ["Perdues", (device) => count(device.lost)],
  ["Doublons", (device) => count(device.duplicates)],
  ["En retard", (device) => count(device.late)],
  ["Redémarrages", (device) => count(device.reboots)],
];

const state = { selectedId: null, pinned: false, headline: "", detailValues: [], snapshot: {} };

function byId(id) {
  return document.getElementById(id);
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function number(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function statusOf(device) {
  return STATUSES.includes(device.status) ? device.status : "OK";
}

function decimal(value, digits) {
  return value.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function count(value) {
  return number(value) === null ? NO_VALUE : decimal(value, 0);
}

function celsius(value) {
  return number(value) === null ? NO_VALUE : `${decimal(value, 1)} °C`;
}

function milli(value, unit) {
  return number(value) === null ? NO_VALUE : `${decimal(value / MILLI_PER_UNIT, 2)} ${unit}`;
}

function duration(ms) {
  if (number(ms) === null) {
    return NO_VALUE;
  }
  const seconds = Math.max(0, Math.floor(ms / MS_PER_SECOND));
  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  if (hours > 0) {
    return `${hours} h ${minutes} min`;
  }
  return minutes > 0 ? `${minutes} min ${seconds % SECONDS_PER_MINUTE} s` : `${seconds} s`;
}

function plural(amount, singular, several) {
  return `${amount} ${amount > 1 ? several : singular}`;
}

function joinFrench(parts) {
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} et ${parts.at(-1)}` : parts.join("");
}

function fleetProblems(fleet) {
  const problems = [
    [number(fleet.crit), "en surchauffe", "en surchauffe"],
    [number(fleet.warn), "à surveiller", "à surveiller"],
    [number(fleet.offline), "ne répond plus", "ne répondent plus"],
  ].filter(([amount]) => amount > 0);
  return problems.map(([amount, one, several], index) => {
    const noun = index === 0 ? ` ${amount > 1 ? "appareils" : "appareil"}` : "";
    return `${amount}${noun} ${amount > 1 ? several : one}`;
  });
}

function receptionSentence(reception) {
  if (reception.health !== "WARN" && reception.health !== "CRIT") {
    return "";
  }
  const loss = number(reception.lossRatePct) ?? 0;
  const invalid = number(reception.invalidRatePct) ?? 0;
  const cause = loss >= invalid ? "perdues" : "invalides";
  return `Réception dégradée : ${decimal(Math.max(loss, invalid), 1)} % de trames ${cause}.`;
}

function headlineText(snapshot) {
  const fleet = snapshot.fleet ?? {};
  const reception = snapshot.reception ?? {};
  if (!number(fleet.total) && !number(reception.received)) {
    return "En attente de trames sur le port UDP…";
  }
  const problems = fleetProblems(fleet);
  const devices = problems.length > 0 ? `${joinFrench(problems)}.` : "";
  const signal = receptionSentence(reception);
  const online = `${plural(number(fleet.online) ?? 0, "appareil", "appareils")} en ligne.`;
  return [devices || (signal ? "" : "Réception saine."), signal, devices ? "" : online].filter(Boolean).join(" ");
}

function fleetLine(snapshot) {
  const fleet = snapshot.fleet ?? {};
  const hottest = list(snapshot.hottest)[0];
  const parts = [`En ligne : ${count(fleet.online)} sur ${count(fleet.total)}`, `${count(fleet.offline)} hors ligne`];
  if (hottest) {
    parts.push(`le plus chaud : n°${hottest.deviceId} à ${celsius(hottest.temperatureC)}`);
  }
  return `${parts.join(", ")}.`;
}

function renderSummary(snapshot) {
  const text = headlineText(snapshot);
  if (text !== state.headline) {
    state.headline = text;
    byId("headline").textContent = text;
  }
  byId("fleet-line").textContent = list(snapshot.devices).length > 0 ? fleetLine(snapshot) : "";
  const reception = snapshot.reception ?? {};
  byId("figures").replaceChildren(
    ...FIGURES.map(([key, label, digits]) => {
      const item = element("li", "figure");
      const value = number(reception[key]);
      item.append(element("span", "figure-value", value === null ? NO_VALUE : decimal(value, digits)), element("span", "figure-label", label));
      return item;
    }),
  );
}

function syncKeyed(container, items, keyOf, create, update) {
  const existing = new Map([...container.children].map((node) => [node.dataset.key, node]));
  const nodes = items.map((item) => {
    const key = String(keyOf(item));
    const node = existing.get(key) ?? create(item);
    node.dataset.key = key;
    update(node, item);
    return node;
  });
  nodes.forEach((node, index) => {
    if (container.children[index] !== node) {
      container.insertBefore(node, container.children[index] ?? null);
    }
  });
  while (container.children.length > nodes.length) {
    container.lastElementChild.remove();
  }
}

function bandOf(lowerC) {
  if (lowerC >= TEMP_CRIT_C) {
    return "crit";
  }
  return lowerC >= TEMP_WARN_C ? "warn" : "ok";
}

function createMeter() {
  const meter = element("span", "meter");
  for (let lowerC = 0; lowerC < METER_MAX_C; lowerC += METER_STEP_C) {
    meter.append(element("span", `segment band-${bandOf(lowerC)}`));
  }
  return meter;
}

function tiltOf(deviceId) {
  const steps = ((Math.abs(number(deviceId) ?? 0) * TILT_SPREAD) % (2 * MAX_TILT_STEPS + 1)) - MAX_TILT_STEPS;
  return `${steps * TILT_DEG_PER_STEP}deg`;
}

function createStrip(device) {
  const strip = element("button", "strip");
  strip.type = "button";
  const tape = element("span", "tape", String(device.deviceId));
  tape.style.setProperty("--tilt", tiltOf(device.deviceId));
  strip.append(element("span", "strip-value"), createMeter(), element("span", "lamp"), tape);
  strip.addEventListener("click", () => selectStrip(device.deviceId));
  return strip;
}

function selectStrip(deviceId) {
  state.pinned = !(state.pinned && state.selectedId === deviceId);
  state.selectedId = deviceId;
  render(state.snapshot);
}

function updateStrip(strip, device) {
  const status = statusOf(device);
  const temperature = status === "OFFLINE" ? null : number(device.temperatureC);
  const lit = temperature === null ? 0 : Math.ceil(temperature / METER_STEP_C);
  strip.dataset.status = status.toLowerCase();
  strip.setAttribute("aria-pressed", String(device.deviceId === state.selectedId));
  strip.setAttribute("aria-label", `Appareil ${device.deviceId}, ${celsius(device.temperatureC)}, ${STATUS_WORDS[status]}`);
  strip.firstChild.textContent = temperature === null ? NO_VALUE : decimal(temperature, 1);
  [...strip.querySelector(".meter").children].forEach((segment, index) => segment.classList.toggle("lit", index < lit));
}

function createCue() {
  const cue = element("li", "cue");
  cue.append(element("span", "cue-device"), element("span", "cue-label"), element("span", "cue-time"));
  return cue;
}

function updateCue(cue, alert) {
  const [device, label, time] = cue.children;
  device.textContent = `n°${alert.deviceId}`;
  label.textContent = ALERT_LABELS[alert.ruleId] ?? alert.label ?? alert.ruleId;
  time.textContent = `depuis ${duration(alert.durationMs)}`;
}

function renderAlerts(alerts) {
  syncKeyed(byId("alerts"), alerts, (alert) => `${alert.deviceId}:${alert.ruleId}`, createCue, updateCue);
  byId("no-alert").hidden = alerts.length > 0;
}

function selectedDevice(snapshot, devices) {
  const chosen = devices.find((device) => device.deviceId === state.selectedId);
  if (chosen && state.pinned) {
    return chosen;
  }
  state.pinned = false;
  return list(snapshot.hottest)[0] ?? chosen ?? devices[0] ?? null;
}

function buildDetail() {
  state.detailValues = DETAIL_FIELDS.map(([label]) => {
    const value = element("dd");
    byId("detail").append(element("dt", "", label), value);
    return value;
  });
}

function renderDetail(device, now) {
  const name = byId("detail-name");
  byId("detail").hidden = !device;
  name.dataset.status = device ? statusOf(device).toLowerCase() : "";
  name.textContent = device ? `Appareil n°${device.deviceId}, ${STATUS_WORDS[statusOf(device)]}` : "Aucun appareil sélectionné";
  DETAIL_FIELDS.forEach(([, read], index) => {
    state.detailValues[index].textContent = device ? read(device, now) : NO_VALUE;
  });
}

function renderReasons(invalidByReason) {
  const counts = invalidByReason && typeof invalidByReason === "object" ? invalidByReason : {};
  const reasons = [...new Set([...Object.keys(REASON_LABELS), ...Object.keys(counts)])];
  byId("reasons").replaceChildren(
    ...reasons.map((reason) => {
      const amount = number(counts[reason]) ?? 0;
      const row = element("tr", amount > 0 ? "" : "zero");
      row.append(element("th", "", REASON_LABELS[reason] ?? reason), element("td", "", decimal(amount, 0)));
      return row;
    }),
  );
}

function render(snapshot) {
  state.snapshot = snapshot;
  const devices = list(snapshot.devices).filter((device) => device && device.deviceId !== undefined);
  const device = selectedDevice(snapshot, devices);
  state.selectedId = device ? device.deviceId : null;
  renderSummary(snapshot);
  syncKeyed(byId("strips"), devices, (item) => item.deviceId, createStrip, updateStrip);
  byId("no-device").hidden = devices.length > 0;
  renderAlerts(list(snapshot.alerts));
  renderDetail(device, number(snapshot.generatedAt) ?? Date.now());
  renderReasons((snapshot.reception ?? {}).invalidByReason);
}

function setConnection(live) {
  const indicator = byId("connection");
  indicator.dataset.state = live ? "live" : "lost";
  indicator.textContent = live ? "Connecté" : "Connexion perdue, nouvelle tentative…";
}

function parseSnapshot(data) {
  try {
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function handleMessage(event) {
  setConnection(true);
  const snapshot = parseSnapshot(event.data);
  if (snapshot) {
    render(snapshot);
  }
}

function connect() {
  const source = new EventSource("/events");
  source.onopen = () => setConnection(true);
  source.onerror = () => setConnection(false);
  source.onmessage = handleMessage;
}

buildDetail();
connect();
