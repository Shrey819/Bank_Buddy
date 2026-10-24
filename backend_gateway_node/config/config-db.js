const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
if (fs.existsSync(path.join(__dirname, "../.env"))) {
  dotenv.config({ path: path.join(__dirname, "../.env") });
} else {
  dotenv.config({ path: path.join(__dirname, "../../.env") });
}

module.exports = {
  DATABASE_URL: process.env.DATABASE_URL || null,
  HOST: process.env.DB_HOST || "localhost",
  USER: process.env.DB_USER || "postgres",
  PASSWORD: process.env.DB_PASSWORD || "postgres",
  DB: process.env.DB_NAME || "banking_demo",
  PORT: parseInt(process.env.DB_PORT || "5432", 10),
  dialect: "postgres",
  ssl: process.env.DB_SSL === "true" || !!process.env.DATABASE_URL,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
};
