const http = require("http");
const app = require("./app");
const env = require("./config/env");
const { initializeConnectorWebSocket } = require("./services/connectorHub");

const server = http.createServer(app);
initializeConnectorWebSocket(server);

server.listen(env.port, env.host, () => {
  console.log(`Tally ERP AI Assistant API listening on ${env.host}:${env.port}`);
});
