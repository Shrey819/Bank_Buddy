require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const app = express();

// Determine backend directory name (supports both backend_gateway_node and app)
const backendDirName = fs.existsSync(path.join(__dirname, "backend_gateway_node"))
  ? "backend_gateway_node"
  : "app";

// Determine frontend directory name (supports both frontend and public)
const frontendDirName = fs.existsSync(path.join(__dirname, "frontend"))
  ? "frontend"
  : "public";

const db = require(`./${backendDirName}/models`);

// Sync database models with PostgreSQL
db.sequelize.sync()
  .then(() => {
    console.log("PostgreSQL database synced successfully.");
  })
  .catch(err => {
    console.error("Failed to sync db: " + err.message);
  });

// Allow Cross-Origin requests
app.use(cors());

// Parse requests of content-type - application/json
app.use(express.json());

// Parse requests of content-type - application/x-www-form-urlencoded
app.use(express.urlencoded({ 
  extended: true 
}));

// Serve static frontend UI
if (fs.existsSync(path.join(__dirname, frontendDirName))) {
  app.use(express.static(path.join(__dirname, frontendDirName)));
}

// Default API route for JSON clients
app.get("/api", (req, res) => {
  res.json({ message: "Bank Buddy API - Secure Node.js, PostgreSQL and JWT Authentication" });
});

// Import application routes
require(`./${backendDirName}/routes/user-routes`)(app);
require(`./${backendDirName}/routes/product-routes`)(app);

const PORT = process.env.PORT || 8080;
let server;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`Server is running on port ${PORT}`);
    console.log(`Open in browser: http://localhost:${PORT}`);
    console.log(`====================================================`);
  });
}

module.exports = { app, server };
