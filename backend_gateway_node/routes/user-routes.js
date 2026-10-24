const { verifyUser } = require("../middleware");
const userServices = require("../services/user-services.js");

module.exports = function(app) {
  app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Headers", "Authorization", "Origin, Content-Type, Accept");
    next();
  });

  // User registration
  app.post("/api/v1/signup", [verifyUser.checkExistingUsername, verifyUser.checkExistingEmail], userServices.signup);

  // User login (CRN, Username or Card Number)
  app.post("/api/v1/signin", userServices.signin);

  // 2-Factor OTP Verification (PRD Step-Up MFA)
  app.post("/api/v1/verify-otp", userServices.verifyOtp);
};
