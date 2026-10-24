require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const app = express();

const db = require("./models");
const userServices = require("./services/user-services.js");

// Sync database models with PostgreSQL
db.sequelize.sync({ alter: true })
  .then(async () => {
    console.log("PostgreSQL database synced successfully.");
    if (userServices.seedDefaultUser) {
      await userServices.seedDefaultUser();
    }
  })
  .catch(err => {
    console.error("Database sync note: " + err.message);
  });

// Allow Cross-Origin requests
app.use(cors());

// Parse requests of content-type - application/json
app.use(express.json());

// Parse requests of content-type - application/x-www-form-urlencoded
app.use(express.urlencoded({ 
  extended: true 
}));

// Serve frontend assets (prioritizing modern React build in ../frontend/dist)
const frontendPath = path.join(__dirname, "..", "frontend");
const distPath = path.join(frontendPath, "dist");
const legacyPath = path.join(frontendPath, "legacy");

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
} else if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
}

// Default API route for JSON clients
app.get("/api", (req, res) => {
  res.json({ message: "Bank Buddy API - Secure Node.js, PostgreSQL and JWT Authentication" });
});

// Import application API routes
require("./routes/user-routes")(app);
require("./routes/product-routes")(app);
require("./routes/chat-routes")(app);

// React SPA Route Fallback (enables client-side routing on reload for /login, /desktop, /chat)
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }
  if (fs.existsSync(path.join(distPath, "index.html"))) {
    return res.sendFile(path.join(distPath, "index.html"));
  }
  // Fallback to legacy static files if dist is not present
  const alias = req.path.replace(/^\//, '') + ".html";
  const legacyFile = path.join(legacyPath, alias);
  if (fs.existsSync(legacyFile)) {
    return res.sendFile(legacyFile);
  }
  const rootFile = path.join(frontendPath, alias);
  if (fs.existsSync(rootFile)) {
    return res.sendFile(rootFile);
  }
  next();
});

const PORT = process.env.PORT || 8080;
let server;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`Bank Buddy Backend Server is running on port ${PORT}`);
    console.log(`Open React UI in browser: http://localhost:${PORT}`);
    console.log(`====================================================`);
  });
}

module.exports = { app, server };
