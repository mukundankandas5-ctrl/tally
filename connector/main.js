import { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, shell } from "electron";
import Store from "electron-store";
import axios from "axios";
import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";

const store = new Store({
  defaults: {
    deviceId: "",
    backendUrl: "",
    deviceToken: "",
    pairedAt: "",
    launchAtStartup: true,
  },
});

const TALLY_PING_XML =
  '<?xml version="1.0" encoding="utf-8"?><ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER><BODY><EXPORTDATA><REQUESTDESC><REPORTNAME>List of Companies</REPORTNAME></REQUESTDESC></EXPORTDATA></BODY></ENVELOPE>';

let tray = null;
let settingsWindow = null;
let statusWindow = null;
let socket = null;
let reconnectDelay = 2000;
let reconnectTimer = null;
let heartbeatInterval = null;
let connectorConnected = false;
let tallyConnected = false;
let tallyCompany = "";
let lastHeartbeatAt = 0;
let lastConnectorMessage = "Starting connector";

function getDeviceId() {
  let deviceId = store.get("deviceId");
  if (!deviceId) {
    deviceId = uuidv4();
    store.set("deviceId", deviceId);
  }
  return deviceId;
}

function getBackendUrl() {
  return String(store.get("backendUrl") || "").trim().replace(/\/$/, "");
}

function getWsUrl() {
  const backendUrl = getBackendUrl();
  if (!backendUrl) return "";
  return backendUrl.replace(/^http/i, "ws") + "/ws";
}

function renderIcon(color) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
      <circle cx="16" cy="16" r="11" fill="${color}" />
      <circle cx="16" cy="16" r="14" fill="none" stroke="#0f172a" stroke-width="2" />
    </svg>
  `;

  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);
}

function currentTrayColor() {
  if (connectorConnected && tallyConnected) return "#22C55E";
  if (connectorConnected && !tallyConnected) return "#F59E0B";
  return "#94A3B8";
}

function getStatusSnapshot() {
  return {
    deviceId: getDeviceId(),
    backendUrl: getBackendUrl(),
    paired: Boolean(store.get("deviceToken")),
    connectorConnected,
    tallyConnected,
    tallyCompany,
    lastHeartbeatAt,
    lastConnectorMessage,
    launchAtStartup: Boolean(store.get("launchAtStartup")),
  };
}

function updateTray() {
  if (!tray) return;

  tray.setImage(renderIcon(currentTrayColor()));
  const heartbeatText = lastHeartbeatAt ? new Date(lastHeartbeatAt).toLocaleTimeString() : "never";
  tray.setToolTip(`Tally AI Connector\nConnector: ${connectorConnected ? "online" : "offline"}\nTally: ${tallyConnected ? tallyCompany || "connected" : "not detected"}\nLast heartbeat: ${heartbeatText}`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Show Status", click: () => openStatusWindow() },
      { label: "Open Settings", click: () => openSettingsWindow("settings") },
      { type: "separator" },
      { label: "Disconnect", click: () => disconnectConnector(true) },
      { label: "Quit", click: () => app.quit() },
    ])
  );
}

function renderWindowHtml(mode) {
  const isSetup = mode === "setup";
  return `
  <!doctype html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <title>Tally AI Connector</title>
      <style>
        body {
          margin: 0;
          font-family: Inter, Segoe UI, sans-serif;
          background: #0f172a;
          color: #e2e8f0;
        }
        .shell {
          padding: 24px;
        }
        .card {
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 24px;
          background: rgba(15, 23, 42, 0.9);
          padding: 24px;
        }
        .label {
          display: block;
          margin-bottom: 8px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #93c5fd;
        }
        .field {
          width: 100%;
          border-radius: 16px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: #fff;
          color: #0f172a;
          padding: 14px 16px;
          font-size: 14px;
          box-sizing: border-box;
        }
        .button {
          border: none;
          border-radius: 16px;
          padding: 12px 16px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }
        .primary {
          background: #2563eb;
          color: white;
        }
        .secondary {
          background: rgba(255,255,255,0.08);
          color: white;
        }
        .row {
          display: grid;
          gap: 16px;
        }
        .status {
          display: grid;
          gap: 12px;
          margin-top: 16px;
          font-size: 14px;
          color: #cbd5e1;
        }
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          width: fit-content;
        }
      </style>
    </head>
    <body>
      <div class="shell">
        <div class="card">
          <div style="font-size:12px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#93c5fd;">Tally AI Connector</div>
          <h1 style="margin:12px 0 8px;font-size:28px;line-height:1.2;">${isSetup ? "Pair this Windows PC" : "Connector Settings"}</h1>
          <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.6;">
            ${isSetup ? "Enter the backend URL and the 6-digit pairing code from the website." : "Update connector settings, startup behavior, and pairing details."}
          </p>

          <form id="settings-form" class="row">
            <div>
              <label class="label">Backend URL</label>
              <input id="backendUrl" class="field" placeholder="https://your-app.onrender.com" />
            </div>
            <div>
              <label class="label">Pairing Code</label>
              <input id="pairingCode" class="field" placeholder="123456" maxlength="6" />
            </div>
            <label style="display:flex;align-items:center;gap:12px;font-size:14px;color:#cbd5e1;">
              <input id="launchAtStartup" type="checkbox" />
              Launch connector when Windows starts
            </label>
            <div style="display:flex;gap:12px;">
              <button class="button primary" type="submit">${isSetup ? "Pair Connector" : "Save Settings"}</button>
              <button class="button secondary" id="closeButton" type="button">Close</button>
            </div>
            <div id="message" style="min-height:20px;font-size:13px;color:#fca5a5;"></div>
          </form>

          <div class="status">
            <div class="pill"><span>Device ID:</span><strong id="deviceId"></strong></div>
            <div>Connector: <strong id="connectorState">Disconnected</strong></div>
            <div>TallyPrime: <strong id="tallyState">Not detected</strong></div>
            <div>Company: <strong id="companyState"></strong></div>
            <div>Last heartbeat: <strong id="heartbeatState"></strong></div>
          </div>
        </div>
      </div>

      <script type="module">
        const state = await window.connectorApi.getState();
        document.getElementById("backendUrl").value = state.backendUrl || "";
        document.getElementById("launchAtStartup").checked = !!state.launchAtStartup;
        document.getElementById("deviceId").textContent = state.deviceId;
        document.getElementById("connectorState").textContent = state.connectorConnected ? "Connected" : "Disconnected";
        document.getElementById("tallyState").textContent = state.tallyConnected ? "Connected" : "Not detected";
        document.getElementById("companyState").textContent = state.tallyCompany || "No active company";
        document.getElementById("heartbeatState").textContent = state.lastHeartbeatAt ? new Date(state.lastHeartbeatAt).toLocaleString() : "Never";

        document.getElementById("settings-form").addEventListener("submit", async (event) => {
          event.preventDefault();
          const response = await window.connectorApi.saveSettings({
            backendUrl: document.getElementById("backendUrl").value,
            pairingCode: document.getElementById("pairingCode").value,
            launchAtStartup: document.getElementById("launchAtStartup").checked,
          });
          document.getElementById("message").textContent = response.message;
        });

        document.getElementById("closeButton").addEventListener("click", () => window.connectorApi.closeWindow());
      </script>
    </body>
  </html>
  `;
}

function createWindow({ mode, width = 520, height = 620, assignment }) {
  const target = new BrowserWindow({
    width,
    height,
    show: false,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: fileURLToPath(new URL("./preload.js", import.meta.url)),
    },
  });

  target.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(renderWindowHtml(mode))}`);
  target.once("ready-to-show", () => target.show());
  target.on("closed", () => assignment(null));

  return target;
}

function openSettingsWindow(mode = "settings") {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = createWindow({
    mode,
    assignment: (value) => {
      settingsWindow = value;
    },
  });
}

function openStatusWindow() {
  if (statusWindow) {
    statusWindow.focus();
    return;
  }

  statusWindow = createWindow({
    mode: "settings",
    width: 440,
    height: 540,
    assignment: (value) => {
      statusWindow = value;
    },
  });
}

function updateStartupSetting() {
  app.setLoginItemSettings({
    openAtLogin: Boolean(store.get("launchAtStartup")),
  });
}

async function pingTally() {
  try {
    const response = await axios.post("http://localhost:9000", TALLY_PING_XML, {
      headers: {
        "Content-Type": "text/xml;charset=utf-8",
      },
      timeout: 10000,
      responseType: "text",
    });

    const raw = String(response.data || "");
    tallyConnected = true;
    tallyCompany =
      (raw.match(/<SVCURRENTCOMPANY>(.*?)<\/SVCURRENTCOMPANY>/i) || [])[1] ||
      (raw.match(/<COMPANYNAME>(.*?)<\/COMPANYNAME>/i) || [])[1] ||
      (raw.match(/<NAME>(.*?)<\/NAME>/i) || [])[1] ||
      "";
    return raw;
  } catch (error) {
    tallyConnected = false;
    tallyCompany = "";
    return "";
  }
}

async function sendHeartbeat() {
  await pingTally();
  lastHeartbeatAt = Date.now();

  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        type: "heartbeat",
        deviceId: getDeviceId(),
        tallyConnected,
        tallyCompany,
        tallyPort: 9000,
        timestamp: new Date().toISOString(),
      })
    );
  }

  updateTray();
}

async function pushXmlToLocalTally(entryId, xml) {
  try {
    const response = await axios.post("http://localhost:9000", xml, {
      headers: {
        "Content-Type": "text/xml;charset=utf-8",
      },
      timeout: 10000,
      responseType: "text",
    });

    const raw = String(response.data || "");
    const success = !/LINEERROR/i.test(raw) && /<CREATED>/i.test(raw);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "push_result", entryId, success, response: raw }));
    }
  } catch (error) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "push_result", entryId, success: false, response: String(error.message || error) }));
    }
  }
}

function stopHeartbeatLoop() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

function startHeartbeatLoop() {
  stopHeartbeatLoop();
  sendHeartbeat();
  heartbeatInterval = setInterval(sendHeartbeat, 10000);
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    connectSocket();
  }, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, 30000);
}

function connectSocket() {
  const backendUrl = getBackendUrl();
  const deviceToken = store.get("deviceToken");

  if (!backendUrl || !deviceToken) {
    connectorConnected = false;
    updateTray();
    openSettingsWindow("setup");
    return;
  }

  lastConnectorMessage = "Connecting to backend";
  const wsUrl = getWsUrl();
  socket = new WebSocket(wsUrl);

  socket.on("open", () => {
    connectorConnected = true;
    clearTimeout(reconnectTimer);
    reconnectDelay = 2000;
    lastConnectorMessage = "Connected to backend";
    socket.send(
      JSON.stringify({
        type: "auth",
        deviceId: getDeviceId(),
        token: store.get("deviceToken"),
      })
    );
    startHeartbeatLoop();
    updateTray();
  });

  socket.on("message", async (rawMessage) => {
    try {
      const message = JSON.parse(String(rawMessage));
      if (message.type === "push_entry") {
        await pushXmlToLocalTally(message.entryId, message.xml);
      }
    } catch (error) {
      lastConnectorMessage = "Received invalid message";
    }
  });

  socket.on("close", () => {
    connectorConnected = false;
    lastConnectorMessage = "Disconnected from backend";
    updateTray();
    scheduleReconnect();
  });

  socket.on("error", () => {
    connectorConnected = false;
    lastConnectorMessage = "Connection error";
    updateTray();
  });
}

function disconnectConnector(clearCredentials = false) {
  stopHeartbeatLoop();
  if (socket) {
    socket.removeAllListeners();
    socket.close();
    socket = null;
  }

  connectorConnected = false;
  tallyConnected = false;
  tallyCompany = "";
  lastConnectorMessage = "Disconnected";

  if (clearCredentials) {
    store.set("deviceToken", "");
    store.set("pairedAt", "");
  }

  updateTray();
  if (clearCredentials) {
    openSettingsWindow("setup");
  }
}

async function pairConnector({ backendUrl, pairingCode, launchAtStartup }) {
  const normalizedBackendUrl = String(backendUrl || "").trim().replace(/\/$/, "");
  const normalizedPairingCode = String(pairingCode || "").trim();

  if (!normalizedBackendUrl) {
    return { ok: false, message: "Backend URL is required." };
  }

  if (store.get("deviceToken") && !normalizedPairingCode) {
    store.set("backendUrl", normalizedBackendUrl);
    store.set("launchAtStartup", Boolean(launchAtStartup));
    updateStartupSetting();
    disconnectConnector(false);
    connectSocket();
    return { ok: true, message: "Settings saved. Connector reconnecting." };
  }

  if (!normalizedPairingCode) {
    return { ok: false, message: "Pairing code is required." };
  }

  try {
    const response = await axios.post(
      `${normalizedBackendUrl}/api/complete-pairing`,
      {
        pairingCode: String(pairingCode).trim(),
        deviceId: getDeviceId(),
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    store.set("backendUrl", normalizedBackendUrl);
    store.set("deviceToken", response.data.token);
    store.set("pairedAt", new Date().toISOString());
    store.set("launchAtStartup", Boolean(launchAtStartup));
    updateStartupSetting();

    if (settingsWindow) {
      settingsWindow.hide();
    }

    disconnectConnector(false);
    connectSocket();

    return { ok: true, message: "Connector paired successfully. Running in tray." };
  } catch (error) {
    return { ok: false, message: error.response?.data?.message || error.message || "Pairing failed." };
  }
}

function createTray() {
  tray = new Tray(renderIcon(currentTrayColor()));
  tray.on("double-click", () => openStatusWindow());
  updateTray();
}

app.whenReady().then(() => {
  createTray();
  updateStartupSetting();

  if (!store.get("deviceToken") || !getBackendUrl()) {
    openSettingsWindow("setup");
  } else {
    connectSocket();
  }
});

app.on("window-all-closed", (event) => {
  event.preventDefault();
});

ipcMain.handle("connector:get-state", () => getStatusSnapshot());
ipcMain.handle("connector:save-settings", async (event, payload) => pairConnector(payload));
ipcMain.handle("connector:close-window", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.hide();
});

ipcMain.handle("connector:open-external", async (event, url) => shell.openExternal(url));
