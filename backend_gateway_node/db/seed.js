require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const fs = require("fs");
const path = require("path");

const sqlFilePath = path.join(__dirname, "sql_data");

async function seed() {
  console.log("====================================================");
  console.log("🏦 Bank Buddy - PostgreSQL Database Seeder");
  console.log("====================================================");

  if (!fs.existsSync(sqlFilePath)) {
    console.error(`❌ SQL data file not found at: ${sqlFilePath}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(sqlFilePath, "utf8");

  let client;

  if (process.env.DATABASE_URL) {
    console.log("🌐 Connecting to Neon DB over Secure Port 443 (Serverless WebSocket)...");
    const { Client, neonConfig } = require("@neondatabase/serverless");
    const ws = require("ws");
    neonConfig.webSocketConstructor = ws;

    client = new Client({
      connectionString: process.env.DATABASE_URL
    });
  } else {
    console.log("💻 Connecting to Local PostgreSQL...");
    const { Client } = require("pg");
    client = new Client({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432", 10),
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "postgres",
      database: process.env.DB_NAME || "banking_demo"
    });
  }

  try {
    await client.connect();
    console.log("✅ Successfully connected to PostgreSQL!");
    console.log("⏳ Executing banking schema & seed queries...");

    await client.query(sqlContent);
    console.log("✅ SQL schema and seed data inserted successfully!\n");

    console.log("📊 Verifying seeded tables:");
    const tables = [
      "customers",
      "accounts",
      "transactions",
      "bills",
      "credit_cards",
      "debit_cards",
      "card_status_history",
      "loans",
      "loan_emis",
      "scheduled_payments",
      "personalized_offers",
      "card_replacement_requests",
      "fraud_disputes"
    ];

    for (const table of tables) {
      try {
        const countRes = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`   • ${table.padEnd(28)} : ${countRes.rows[0].count} records`);
      } catch (err) {
        console.warn(`   • ${table.padEnd(28)} : [Query warning: ${err.message}]`);
      }
    }

    console.log("\n====================================================");
    console.log("🎉 Bank Buddy Database is LIVE, seeded, and ready to use!");
    console.log("====================================================");
  } catch (err) {
    console.error("❌ Error running database seed:", err.message || err);
    process.exit(1);
  } finally {
    if (client) {
      await client.end().catch(() => {});
    }
  }
}

if (require.main === module) {
  seed();
}

module.exports = seed;
