const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { createPairingCodeForUser, completePairing } = require("../services/pairingService");
const { getDeviceStatusForUser, queuePushToUserDevice } = require("../services/connectorHub");

const router = express.Router();

router.get("/tally-status", requireAuth, (req, res) => {
  res.json(getDeviceStatusForUser(req.auth.userId));
});

router.post("/pair-device", requireAuth, (req, res) => {
  res.json({
    pairingCode: createPairingCodeForUser(req.auth.userId),
  });
});

router.post("/complete-pairing", express.json({ limit: "2mb" }), (req, res, next) => {
  try {
    const result = completePairing(req.body?.pairingCode, req.body?.deviceId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/push-to-tally", requireAuth, express.json({ limit: "20mb" }), async (req, res, next) => {
  try {
    const queued = queuePushToUserDevice(req.auth.userId, req.body?.xml || "");
    const result = await queued.promise;
    res.json({
      entryId: queued.entryId,
      status: result.success ? "completed" : "failed",
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
