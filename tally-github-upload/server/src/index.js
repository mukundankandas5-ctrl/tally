const app = require("./app");
const env = require("./config/env");

app.listen(env.port, () => {
  console.log(`Tally ERP AI Assistant API listening on port ${env.port}`);
});
