const app = require("./app");
const env = require("./config/env");

app.listen(env.port, env.host, () => {
  console.log(`Tally ERP AI Assistant API listening on ${env.host}:${env.port}`);
});
