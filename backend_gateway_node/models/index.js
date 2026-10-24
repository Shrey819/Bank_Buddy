const configuration = require("../config/config-db.js");
const Sequelize = require("sequelize");

const dialectOptions = configuration.ssl
  ? {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  : {};

let dialectModule;
if (configuration.DATABASE_URL) {
  const neon = require("@neondatabase/serverless");
  const ws = require("ws");
  neon.neonConfig.webSocketConstructor = ws;
  dialectModule = neon;
}

const sequelize = configuration.DATABASE_URL
  ? new Sequelize(configuration.DATABASE_URL, {
      dialect: configuration.dialect,
      dialectModule,
      dialectOptions,
      pool: configuration.pool,
      logging: false
    })
  : new Sequelize(
      configuration.DB, 
      configuration.USER, 
      configuration.PASSWORD, {
        host: configuration.HOST,
        port: configuration.PORT,
        dialect: configuration.dialect,
        dialectOptions,
        pool: configuration.pool,
        logging: false
      }
    );

const database = {};
database.Sequelize = Sequelize;
database.sequelize = sequelize;
database.product = require("./product.js")(sequelize, Sequelize);
database.user = require("./user.js")(sequelize, Sequelize);

module.exports = database;
