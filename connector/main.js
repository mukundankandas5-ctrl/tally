const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, shell, Notification, dialog } = require("electron");
const Store = require("electron-store");
const axios = require("axios");
const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

app.disableHardwareAcceleration();

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const wins = [statusWindow, settingsWindow].filter(Boolean);
    if (wins.length > 0) {
      if (wins[0].isMinimized()) wins[0].restore();
      wins[0].show();
      wins[0].focus();
    } else {
      openStatusWindow();
    }
  });
}

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
let hasShownTrayNotice = false;
let isQuitting = false;
let socketConnectTimer = null;
let logFilePath = "";

function appendLog(message) {
  try {
    if (!logFilePath && app.getPath) {
      logFilePath = path.join(app.getPath("userData"), "connector.log");
    }
    fs.appendFileSync(logFilePath, `[${new Date().toISOString()}] ${message}\n`, "utf8");
  } catch (error) {}
}

process.on("uncaughtException", function (error) {
  appendLog(`uncaughtException: ${error && error.stack ? error.stack : error}`);
});

process.on("unhandledRejection", function (reason) {
  appendLog(`unhandledRejection: ${reason && reason.stack ? reason.stack : reason}`);
});

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

// Removed renderWindowHtml - now using index.html

function createWindow(opts) {
  var mode = opts.mode;
  var width = opts.width || 520;
  var height = opts.height || 620;
  var assignment = opts.assignment;

  var target = new BrowserWindow({
    width: width,
    height: height,
    show: false,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  target.loadFile(path.join(__dirname, "index.html"));
  target.once("ready-to-show", function() {
    if (!target.isDestroyed()) {
      target.show();
      target.focus();
    }
  });
  target.webContents.once("did-finish-load", function() {
    if (!target.isDestroyed() && !target.isVisible()) {
      target.show();
      target.focus();
    }
  });
  target.on("closed", function() { assignment(null); });

  return target;
}

function openSettingsWindow(mode) {
  if (!mode) mode = "settings";
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = createWindow({
    mode: mode,
    assignment: function(value) {
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
    assignment: function(value) {
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
    var response = await axios.post("http://localhost:9000", TALLY_PING_XML, {
      headers: {
        "Content-Type": "text/xml;charset=utf-8",
      },
      timeout: 10000,
      responseType: "text",
    });

    var raw = String(response.data || "");
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
        tallyConnected: tallyConnected,
        tallyCompany: tallyCompany,
        tallyPort: 9000,
        timestamp: new Date().toISOString(),
      })
    );
  }

  updateTray();
}

async function pushXmlToLocalTally(entryId, xml) {
  try {
    var response = await axios.post("http://localhost:9000", xml, {
      headers: {
        "Content-Type": "text/xml;charset=utf-8",
      },
      timeout: 10000,
      responseType: "text",
    });

    var raw = String(response.data || "");
    var success = !/LINEERROR/i.test(raw) && /<CREATED>/i.test(raw);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "push_result", entryId: entryId, success: success, response: raw }));
    }
  } catch (error) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "push_result", entryId: entryId, success: false, response: String(error.message || error) }));
    }
  }
}

function stopHeartbeatLoop() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function clearSocketConnectTimer() {
  if (socketConnectTimer) {
    clearTimeout(socketConnectTimer);
    socketConnectTimer = null;
  }
}

function startHeartbeatLoop() {
  stopHeartbeatLoop();
  sendHeartbeat();
  heartbeatInterval = setInterval(sendHeartbeat, 10000);
}

function scheduleReconnect() {
  if (isQuitting) return;
  clearReconnectTimer();
  reconnectTimer = setTimeout(function() {
    reconnectTimer = null;
    connectSocket();
  }, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, 30000);
}

function connectSocket() {
  if (isQuitting) return;
  var backendUrl = getBackendUrl();
  var deviceToken = store.get("deviceToken");

  if (!backendUrl || !deviceToken) {
    stopHeartbeatLoop();
    clearReconnectTimer();
    clearSocketConnectTimer();
    connectorConnected = false;
    lastConnectorMessage = "Waiting for pairing details";
    updateTray();
    openSettingsWindow("setup");
    return;
  }

  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  lastConnectorMessage = "Connecting to backend";
  var wsUrl = getWsUrl();
  var nextSocket = new WebSocket(wsUrl);
  socket = nextSocket;
  clearSocketConnectTimer();
  socketConnectTimer = setTimeout(function() {
    if (nextSocket.readyState === WebSocket.CONNECTING) {
      lastConnectorMessage = "Connection timeout. Retrying...";
      try {
        nextSocket.terminate();
      } catch (error) {}
    }
  }, 12000);

  nextSocket.on("open", function() {
    clearSocketConnectTimer();
    connectorConnected = true;
    clearReconnectTimer();
    reconnectDelay = 2000;
    lastConnectorMessage = "Connected to backend";
    nextSocket.send(
      JSON.stringify({
        type: "auth",
        deviceId: getDeviceId(),
        token: store.get("deviceToken"),
      })
    );
    startHeartbeatLoop();
    updateTray();
  });

  nextSocket.on("message", async function(rawMessage) {
    try {
      var message = JSON.parse(String(rawMessage));
      if (message.type === "auth_ok") {
        lastConnectorMessage = "Connector authenticated";
        updateTray();
        return;
      }
      if (message.type === "push_entry") {
        await pushXmlToLocalTally(message.entryId, message.xml);
      }
    } catch (error) {
      lastConnectorMessage = "Received invalid message";
    }
  });

  nextSocket.on("close", function(code) {
    clearSocketConnectTimer();
    if (socket === nextSocket) {
      socket = null;
    }
    stopHeartbeatLoop();
    connectorConnected = false;
    if (code === 4001) {
      store.set("deviceToken", "");
      store.set("pairedAt", "");
      lastConnectorMessage = "Session expired. Please pair connector again.";
      updateTray();
      openSettingsWindow("setup");
      return;
    }

    lastConnectorMessage = "Disconnected from backend";
    updateTray();
    scheduleReconnect();
  });

  nextSocket.on("error", function() {
    clearSocketConnectTimer();
    stopHeartbeatLoop();
    connectorConnected = false;
    lastConnectorMessage = "Connection error";
    updateTray();
    scheduleReconnect();
  });
}

function disconnectConnector(clearCredentials) {
  stopHeartbeatLoop();
  clearReconnectTimer();
  clearSocketConnectTimer();
  if (socket) {
    const activeSocket = socket;
    socket = null;
    activeSocket.removeAllListeners();
    try {
      if (activeSocket.readyState === WebSocket.CONNECTING) {
        activeSocket.terminate();
      } else {
        activeSocket.close();
      }
    } catch (error) {}
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

async function pairConnector(opts) {
  var backendUrl = opts.backendUrl;
  var pairingCode = opts.pairingCode;
  var launchAtStartup = opts.launchAtStartup;

  var normalizedBackendUrl = String(backendUrl || "").trim().replace(/\/$/, "");
  var normalizedPairingCode = String(pairingCode || "").trim();

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
    var response = await axios.post(
      normalizedBackendUrl + "/api/complete-pairing",
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
    return { ok: false, message: (error.response && error.response.data && error.response.data.message) || error.message || "Pairing failed." };
  }
}

function createTray() {
  tray = new Tray(renderIcon(currentTrayColor()));
  tray.on("double-click", function() { openStatusWindow(); });
  tray.on("click", function() {
    if (settingsWindow) {
      settingsWindow.show();
      settingsWindow.focus();
    } else {
      openStatusWindow();
    }
  });
  updateTray();
}

if (gotTheLock) {
  app.whenReady().then(function () {
    createTray();
    updateStartupSetting();

    if (!store.get("deviceToken") || !getBackendUrl()) {
      openSettingsWindow("setup");
    } else {
      openStatusWindow();
      connectSocket();
    }
  });

  app.on("activate", function () {
    if (settingsWindow) {
      settingsWindow.show();
      settingsWindow.focus();
      return;
    }
    if (statusWindow) {
      statusWindow.show();
      statusWindow.focus();
      return;
    }
    if (!store.get("deviceToken") || !getBackendUrl()) {
      openSettingsWindow("setup");
    } else {
      openStatusWindow();
    }
  });

  app.on("window-all-closed", function (event) {
    if (!isQuitting) {
      event.preventDefault();
    }
  });

  app.on("before-quit", function () {
    isQuitting = true;
    disconnectConnector(false);
    if (tray) {
      tray.destroy();
      tray = null;
    }
  });

  ipcMain.handle("connector:get-state", function () {
    return getStatusSnapshot();
  });
  ipcMain.handle("connector:save-settings", function (event, payload) {
    return pairConnector(payload);
  });
  ipcMain.handle("connector:close-window", function (event) {
    var win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.hide();
      if (!hasShownTrayNotice && Notification.isSupported()) {
        new Notification({
          title: "Tally AI Connector",
          body: "The connector is still running in the background tray.",
          silent: true,
        }).show();
        hasShownTrayNotice = true;
      }
    }
  });

  ipcMain.handle("connector:quit-app", function () {
    app.quit();
  });

  ipcMain.handle("connector:open-external", function (event, url) {
    return shell.openExternal(url);
  });
}
