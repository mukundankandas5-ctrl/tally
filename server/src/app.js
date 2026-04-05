const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const env = require("./config/env");
const AppError = require("./utils/appError");
const invoiceRoutes = require("./routes/invoiceRoutes");
const bankStatementRoutes = require("./routes/bankStatementRoutes");
const referenceRoutes = require("./routes/referenceRoutes");
const recommendationRoutes = require("./routes/recommendationRoutes");
const gstRoutes = require("./routes/gstRoutes");
const tallyRoutes = require("./routes/tallyRoutes");
const connectorRoutes = require("./routes/connectorRoutes");

const app = express();

app.use(
  cors({
    origin: env.corsOrigin,
  })
);
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/reference", referenceRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/bank-statements", bankStatementRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/gst", gstRoutes);
app.use("/api/tally", tallyRoutes);
app.use("/api", connectorRoutes);

const clientDistPath = path.resolve(__dirname, "../../client/dist");

if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }

    return res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

app.use((req, res, next) => {
  next(new AppError("The requested resource was not found.", 404));
});

app.use((error, req, res, next) => {
  const statusCode = error.statusCode || 500;

  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      error: "Upload error",
      message: error.message,
    });
  }

  return res.status(statusCode).json({
    error: statusCode >= 500 ? "Server error" : "Request error",
    message: error.message || "Something went wrong.",
    details: error.details || null,
  });
});

module.exports = app;
