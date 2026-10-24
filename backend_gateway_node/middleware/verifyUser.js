const database = require("../models");
const User = database.user;
const Sequelize = database.Sequelize;

// OWASP Input Validation Middleware for Registration
const validateSignup = (req, res, next) => {
  let { name, username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).send({
      message: "Username, email, and password cannot be empty!"
    });
  }

  username = username.toString().trim();
  email = email.toString().trim();

  // Username validation: alphanumeric + underscores, 3-30 chars
  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  if (!usernameRegex.test(username)) {
    return res.status(400).send({
      message: "Username must be 3-30 characters long and contain only letters, numbers, or underscores."
    });
  }

  // Email format validation (OWASP Standard)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email) || email.length > 100) {
    return res.status(400).send({
      message: "Invalid email address format."
    });
  }

  // Password complexity: minimum 8 characters, at least one letter and at least one digit
  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).send({
      message: "Password must be at least 8 characters long."
    });
  }

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  if (!hasLetter || !hasDigit) {
    return res.status(400).send({
      message: "Password must contain both letters and numbers."
    });
  }

  req.body.username = username;
  req.body.email = email;
  if (name) req.body.name = name.toString().trim();

  next();
};

const checkExistingUsername = async (req, res, next) => {
  try {
    const cleanUsername = (req.body.username || "").toString().trim();
    const cleanEmail = (req.body.email || "").toString().trim();

    // Case-insensitive search in PostgreSQL
    const user = await User.findOne({
      where: Sequelize.where(
        Sequelize.fn('lower', Sequelize.col('username')),
        cleanUsername.toLowerCase()
      )
    });

    if (user) {
      // If the email also matches, allow updating the user's password in database
      if (user.email && user.email.toLowerCase() === cleanEmail.toLowerCase()) {
        req.isUserUpdate = true;
        req.existingUserId = user.id;
        return next();
      }
      return res.status(400).send({
        message: "Username already used! Please choose a different username."
      });
    }

    next();
  } catch (err) {
    return res.status(500).send({
      message: "Error verifying username availability: " + err.message
    });
  }
};

const checkExistingEmail = async (req, res, next) => {
  try {
    if (req.isUserUpdate) {
      return next();
    }

    const cleanEmail = (req.body.email || "").toString().trim();

    // Case-insensitive search in PostgreSQL
    const user = await User.findOne({
      where: Sequelize.where(
        Sequelize.fn('lower', Sequelize.col('email')),
        cleanEmail.toLowerCase()
      )
    });

    if (user) {
      return res.status(400).send({
        message: "Email already used!"
      });
    }

    next();
  } catch (err) {
    return res.status(500).send({
      message: "Error verifying email availability: " + err.message
    });
  }
};

const verifyUser = {
  validateSignup,
  checkExistingUsername,
  checkExistingEmail
};

module.exports = verifyUser;
