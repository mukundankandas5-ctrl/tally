const WebSocket = require("ws");
const { randomUUID } = require("crypto");
const { cleanString } = require("../utils/normalizers");
const { getDeviceByUserId, validateDeviceToken } = require("./deviceAuthStore");
const { queuePendingPush } = require("../db/database");

const connectedDevices = new Map();
const pendingPushes = new Map();
const pendingLedgerRequests = new Map();

function safeJsonParse(rawMessage) {
  try {
    return JSON.parse(String(rawMessage));
  } catch (error) {
    return null;
  }
}

function registerDevice({ ws, userId, deviceId }) {
  connectedDevices.set(deviceId, {
    ws,
    userId,
    tallyConnected: false,
    tallyCompany: "",
    lastSeen: Date.now(),
  });

  ws.__deviceId = deviceId;
  ws.__authenticated = true;
}

function resolvePendingPush(entryId, payload) {
  const pending = pendingPushes.get(entryId);
  if (!pending) {
    return;
  }

  clearTimeout(pending.timeoutId);
  pendingPushes.delete(entryId);
  pending.resolve(payload);
}

function rejectPendingPush(entryId, error) {
  const pending = pendingPushes.get(entryId);
  if (!pending) {
    return;
  }

  clearTimeout(pending.timeoutId);
  pendingPushes.delete(entryId);
  pending.reject(error);
}

function resolvePendingLedgerRequest(requestId, payload) {
  const pending = pendingLedgerRequests.get(requestId);
  if (!pending) {
    return;
  }

  clearTimeout(pending.timeoutId);
  pendingLedgerRequests.delete(requestId);
  pending.resolve(payload);
}

function rejectPendingLedgerRequest(requestId, error) {
  const pending = pendingLedgerRequests.get(requestId);
  if (!pending) {
    return;
  }

  clearTimeout(pending.timeoutId);
  pendingLedgerRequests.delete(requestId);
  pending.reject(error);
}

function initializeConnectorWebSocket(server) {
  const wss = new WebSocket.Server({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    if (req.url === "/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
      return;
    }

    socket.destroy();
  });

  wss.on("connection", (ws) => {
    ws.on("message", (rawMessage) => {
      const message = safeJsonParse(rawMessage);
      if (!message?.type) {
        return;
      }

      if (message.type === "auth") {
        const record = validateDeviceToken(message.deviceId, message.token);
        if (!record) {
          ws.close(4001, "AUTH_FAILED");
          return;
        }

        registerDevice({
          ws,
          userId: record.userId,
          deviceId: record.deviceId,
        });

        ws.send(
          JSON.stringify({
            type: "auth_ok",
            deviceId: record.deviceId,
          })
        );

        return;
      }

      if (!ws.__authenticated) {
        ws.close(4001, "AUTH_REQUIRED");
        return;
      }

      if (message.type === "heartbeat") {
        const device = connectedDevices.get(cleanString(message.deviceId));
        if (!device) {
          return;
        }

        connectedDevices.set(cleanString(message.deviceId), {
          ...device,
          tallyConnected: Boolean(message.tallyConnected),
          tallyCompany: cleanString(message.tallyCompany),
          lastSeen: Date.now(),
        });
        return;
      }

      if (message.type === "push_result") {
        resolvePendingPush(cleanString(message.entryId), {
          entryId: cleanString(message.entryId),
          success: Boolean(message.success),
          response: cleanString(message.response),
        });
        return;
      }

      if (message.type === "ledger_result") {
        if (message.success) {
          resolvePendingLedgerRequest(cleanString(message.requestId), message.xml);
        } else {
          rejectPendingLedgerRequest(cleanString(message.requestId), new Error(message.error || "Failed to fetch ledgers"));
        }
        return;
      }
    });

    ws.on("close", () => {
      const deviceId = ws.__deviceId;
      if (deviceId) {
        connectedDevices.delete(deviceId);
      }
    });
  });

  return wss;
}

function getDeviceStatusForUser(userId) {
  const linkedDevice = getDeviceByUserId(userId);
  if (!linkedDevice) {
    return {
      connectorConnected: false,
      tallyConnected: false,
      tallyCompany: "",
      lastSeen: 0,
    };
  }

  const device = connectedDevices.get(linkedDevice.deviceId);
  if (!device || Date.now() - Number(device.lastSeen || 0) > 30000) {
    return {
      connectorConnected: false,
      tallyConnected: false,
      tallyCompany: "",
      lastSeen: Number(device?.lastSeen || 0),
    };
  }

  return {
    connectorConnected: true,
    tallyConnected: Boolean(device.tallyConnected),
    tallyCompany: cleanString(device.tallyCompany),
    lastSeen: Number(device.lastSeen || 0),
  };
}

function queuePushToUserDevice(userId, xml, options = {}) {
  const linkedDevice = getDeviceByUserId(userId);
  if (!linkedDevice) {
    const error = new Error("Tally not connected");
    error.statusCode = 503;
    throw error;
  }

  const device = connectedDevices.get(linkedDevice.deviceId);
  if (!device || !device.ws || device.ws.readyState !== WebSocket.OPEN || !device.tallyConnected) {
    const entryId = queuePendingPush({
      clientId: options.clientId || null,
      type: options.type || "batch",
      payload: { companyName: options.companyName || "", xml }
    });

    return {
      entryId,
      promise: Promise.resolve({ success: true, queued: true, message: "Offline. Added to pending queue.", entryId })
    };
  }

  const entryId = randomUUID();
  const promise = new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingPushes.delete(entryId);
      reject(Object.assign(new Error("Timed out waiting for Tally connector response."), { statusCode: 504 }));
    }, 30000);

    pendingPushes.set(entryId, { resolve, reject, timeoutId });
  });

  device.ws.send(
    JSON.stringify({
      type: "push_entry",
      entryId,
      xml: cleanString(xml),
    })
  );

  return {
    entryId,
    promise,
  };
}

async function fetchLedgersFromUserDevice(userId) {
  const linkedDevice = getDeviceByUserId(userId);
  if (!linkedDevice) {
    const error = new Error("Tally not connected");
    error.statusCode = 503;
    throw error;
  }

  const device = connectedDevices.get(linkedDevice.deviceId);
  if (!device || !device.ws || device.ws.readyState !== WebSocket.OPEN || !device.tallyConnected) {
    const error = new Error("Tally connector is offline or Tally is not reachable.");
    error.statusCode = 503;
    throw error;
  }

  const requestId = randomUUID();
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingLedgerRequests.delete(requestId);
      reject(Object.assign(new Error("Timed out waiting for Tally ledger sync."), { statusCode: 504 }));
    }, 60000);

    pendingLedgerRequests.set(requestId, { resolve, reject, timeoutId });

    device.ws.send(JSON.stringify({ type: "get_ledgers", requestId }));
  });
}

module.exports = {
  connectedDevices,
  getDeviceStatusForUser,
  initializeConnectorWebSocket,
  queuePushToUserDevice,
  fetchLedgersFromUserDevice,
  rejectPendingPush,
};
