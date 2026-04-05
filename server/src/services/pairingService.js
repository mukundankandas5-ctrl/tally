const { randomUUID } = require("crypto");
const { cleanString } = require("../utils/normalizers");
const { upsertDeviceForUser } = require("./deviceAuthStore");
const AppError = require("../utils/appError");

const pairingCodes = new Map();

function generatePairingCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function createPairingCodeForUser(userId) {
  const pairingCode = generatePairingCode();
  pairingCodes.set(pairingCode, {
    userId: cleanString(userId),
    expiresAt: Date.now() + 5 * 60 * 1000,
    requestId: randomUUID(),
  });
  return pairingCode;
}

function completePairing(pairingCode, deviceId) {
  const record = pairingCodes.get(cleanString(pairingCode));

  if (!record || record.expiresAt < Date.now()) {
    pairingCodes.delete(cleanString(pairingCode));
    throw new AppError("Pairing code is invalid or has expired.", 400);
  }

  if (!cleanString(deviceId)) {
    throw new AppError("Device ID is required to complete pairing.", 400);
  }

  pairingCodes.delete(cleanString(pairingCode));
  const token = upsertDeviceForUser(record.userId, deviceId);

  return {
    token,
    userId: record.userId,
    deviceId: cleanString(deviceId),
  };
}

module.exports = {
  completePairing,
  createPairingCodeForUser,
};
