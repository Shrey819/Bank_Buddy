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

// Serve static frontend UI from ../frontend
const frontendPath = path.join(__dirname, "..", "frontend");
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));

  // Direct route aliases for desktop and chat pages
  app.get("/desktop", (req, res) => {
    res.sendFile(path.join(frontendPath, "desktop.html"));
  });

  app.get("/chat", (req, res) => {
    res.sendFile(path.join(frontendPath, "chat.html"));
  });
}

// Default API route for JSON clients
app.get("/api", (req, res) => {
  res.json({ message: "Bank Buddy API - Secure Node.js, PostgreSQL and JWT Authentication" });
});

// Import application routes
require("./routes/user-routes")(app);
require("./routes/product-routes")(app);

const PORT = process.env.PORT || 8080;
let server;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`Bank Buddy Backend Server is running on port ${PORT}`);
    console.log(`Open in browser: http://localhost:${PORT}`);
    console.log(`====================================================`);
  });
}

module.exports = { app, server };
