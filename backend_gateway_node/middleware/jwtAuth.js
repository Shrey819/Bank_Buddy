const jwt = require("jsonwebtoken");
const configuration = require("../config/config-jwt.js");

// In-memory token revocation blacklist with expiration tracking (OWASP Token Invalidation)
const revokedTokens = new Map();

// Helper to periodically cleanup expired tokens from memory every 10 minutes
setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const [token, exp] of revokedTokens.entries()) {
    if (exp <= now) {
      revokedTokens.delete(token);
    }
  }
}, 10 * 60 * 1000).unref(); // unref so it does not block node process shutdown

const revokeToken = (token) => {
  if (!token) return;
  try {
    const decoded = jwt.decode(token);
    const exp = decoded && decoded.exp ? decoded.exp : Math.floor(Date.now() / 1000) + 86400;
    revokedTokens.set(token, exp);
  } catch (e) {
    revokedTokens.set(token, Math.floor(Date.now() / 1000) + 86400);
  }
};

const isTokenRevoked = (token) => {
  if (!token) return false;
  return revokedTokens.has(token);
};

const verifyToken = (req, res, next) => {
  const bearer = req.headers['authorization'] || req.headers['x-access-token'];

  if (!bearer) {
    return res.status(403).send({
      message: "No token provided!"
    });
  }

  let token = bearer;
  const match = bearer.match(/^Bearer\s+(.+)$/i);
  if (match) {
    token = match[1];
  }
  token = token.trim();

  if (!token) {
    return res.status(403).send({
      message: "Error when get token!"
    });
  }

  // Check if token has been revoked via logout
  if (isTokenRevoked(token)) {
    return res.status(401).send({
      message: "Token has been revoked or session terminated. Please log in again."
    });
  }

  jwt.verify(token, configuration.secret, (err, decoded) => {
    if (err) {
      return res.status(401).send({
        message: "User unauthorized!"
      });
    }

    // OWASP & PRD Security: Step 1 pre-MFA tokens must never access protected resources
    if (decoded.pendingMfa) {
      return res.status(403).send({
        message: "Multi-Factor Authentication required. Access denied."
      });
    }

    req.userId = decoded.id;
    req.userRole = decoded.role;
    req.token = token;
    req.decodedToken = decoded;
    next();
  });
};

const jwtAuth = {
  verifyToken,
  revokeToken,
  isTokenRevoked
};

module.exports = jwtAuth;
