const { verifyUser, jwtAuth } = require("../middleware");
const userServices = require("../services/user-services.js");

module.exports = function(app) {
  app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Headers", "Authorization, Origin, Content-Type, Accept, x-access-token");
    next();
  });

  // User registration with OWASP input validation and duplicate checks
  app.post(
    "/api/v1/signup",
    [verifyUser.validateSignup, verifyUser.checkExistingUsername, verifyUser.checkExistingEmail],
    userServices.signup
  );

  // User login (CRN, Username, Card Number or Email)
  app.post("/api/v1/signin", userServices.signin);

  // 2-Factor OTP Verification (PRD Step-Up MFA)
  app.post("/api/v1/verify-otp", userServices.verifyOtp);

  // Current session profile verification (Protected route)
  app.get("/api/v1/me", [jwtAuth.verifyToken], userServices.getMe);

  // User logout & token revocation (Protected route)
  app.post("/api/v1/logout", [jwtAuth.verifyToken], userServices.logout);
};
