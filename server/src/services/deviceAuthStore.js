const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { cleanString } = require("../utils/normalizers");

const dataDirectory = path.resolve(__dirname, "../data");
const storeFile = path.join(dataDirectory, "device-auth.json");

function ensureStoreFile() {
  if (!fs.existsSync(dataDirectory)) {
    fs.mkdirSync(dataDirectory, { recursive: true });
  }

  if (!fs.existsSync(storeFile)) {
    fs.writeFileSync(storeFile, JSON.stringify({ devices: [] }, null, 2), "utf8");
  }
}

function readStore() {
  ensureStoreFile();
  try {
    return JSON.parse(fs.readFileSync(storeFile, "utf8"));
  } catch (error) {
    return { devices: [] };
  }
}

function writeStore(nextStore) {
  ensureStoreFile();
  fs.writeFileSync(storeFile, JSON.stringify(nextStore, null, 2), "utf8");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(cleanString(token)).digest("hex");
}

function generateDeviceToken() {
  return crypto.randomBytes(32).toString("hex");
}

function upsertDeviceForUser(userId, deviceId) {
  const token = generateDeviceToken();
  const store = readStore();
  const devices = Array.isArray(store.devices) ? store.devices : [];
  const nextRecord = {
    userId: cleanString(userId),
    deviceId: cleanString(deviceId),
    tokenHash: hashToken(token),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const existingIndex = devices.findIndex((item) => item.userId === nextRecord.userId || item.deviceId === nextRecord.deviceId);
  if (existingIndex >= 0) {
    devices[existingIndex] = {
      ...devices[existingIndex],
      ...nextRecord,
    };
  } else {
    devices.push(nextRecord);
  }

  writeStore({ devices });
  return token;
}

function validateDeviceToken(deviceId, token) {
  const hashedToken = hashToken(token);
  const store = readStore();
  const record = (store.devices || []).find((item) => item.deviceId === cleanString(deviceId) && item.tokenHash === hashedToken);
  return record || null;
}

function getDeviceByUserId(userId) {
  const store = readStore();
  return (store.devices || []).find((item) => item.userId === cleanString(userId)) || null;
}

module.exports = {
  getDeviceByUserId,
  upsertDeviceForUser,
  validateDeviceToken,
};
