const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

module.exports = {
  port: Number(process.env.PORT || 4000),
  host: process.env.HOST || "0.0.0.0",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  anthropicModel: "claude-sonnet-4-20250514",
  defaultUserId: process.env.DEFAULT_USER_ID || "local-user",
};
