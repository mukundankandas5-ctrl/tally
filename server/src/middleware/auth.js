const env = require("../config/env");

function requireAuth(req, res, next) {
  req.auth = {
    userId: req.header("x-user-id") || env.defaultUserId,
  };

  next();
}

module.exports = {
  requireAuth,
};
