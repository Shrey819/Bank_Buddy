const bankingServices = require("../services/banking-services.js");

module.exports = function(app) {
  app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Headers", "Authorization, Origin, Content-Type, Accept, x-access-token");
    next();
  });

  // Fetch full banking dashboard data
  app.get("/api/v1/dashboard-data", bankingServices.getDashboardData);

  // Add (Deposit/Credit) or Subtract (Transfer/Payment/Debit) funds with instant ledger update
  app.post("/api/v1/accounts/adjust-balance", bankingServices.adjustBalance);

  // Sweep safe surplus to sovereign vault
  app.post("/api/v1/sweep-surplus", bankingServices.sweepSurplus);

  // Toggle debit card freeze/unfreeze
  app.post("/api/v1/cards/toggle-freeze", bankingServices.toggleCardFreeze);
};
