const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getRecentActivities, getSyncHistory } = require("../db/database");

const router = express.Router();

router.get("/activities", requireAuth, (req, res, next) => {
  try {
    const activities = getRecentActivities(20);
    res.json(activities);
  } catch (error) {
    next(error);
  }
});

router.get("/sync-history", requireAuth, (req, res, next) => {
  try {
    const history = getSyncHistory(100);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
