const database = require("../models");
const configuration = require("../config/config-jwt.js");
const jwtAuth = require("../middleware/jwtAuth.js");
const User = database.user;
const Op = database.Sequelize.Op;
const Sequelize = database.Sequelize;

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const BCRYPT_SALT_ROUNDS = 10; // OWASP recommendation: minimum 10 rounds

// Seed default banking users (PRD C1001 Private Wealth Clients)
exports.seedDefaultUser = async () => {
  try {
    const hashedPassword = bcrypt.hashSync("BankBuddy@2026", BCRYPT_SALT_ROUNDS);

    // 1. Elena Rostova
    const elena = await User.findOne({
      where: {
        [Op.or]: [{ username: "elena" }, { crn: "98234105" }]
      }
    });
    if (!elena) {
      await User.create({
        name: "Elena Rostova",
        username: "elena",
        email: "elena.rostova@wealth.client",
        password: hashedPassword,
        crn: "98234105",
        cardNumber: "4441",
        phone: "+91 9876543210",
        role: "Private Wealth Client",
        kycStatus: "VERIFIED",
        otpSecret: "123456"
      });
      console.log("Seeded default banking user: Elena Rostova (CRN: 98234105)");
    }

    // 2. Aarav Patel
    const aarav = await User.findOne({
      where: {
        [Op.or]: [{ username: "aarav_patel" }, { crn: "77889900" }]
      }
    });
    if (!aarav) {
      await User.create({
        name: "Aarav Patel",
        username: "aarav_patel",
        email: "aarav.patel@bankbuddy.in",
        password: hashedPassword,
        crn: "77889900",
        cardNumber: "7788",
        phone: "+91 9876543212",
        role: "Private Wealth Client",
        kycStatus: "VERIFIED",
        otpSecret: "123456"
      });
      console.log("Seeded default banking user: Aarav Patel (CRN: 77889900)");
    }

    // 3. Shrey819
    const shrey = await User.findOne({
      where: {
        [Op.or]: [{ username: "Shrey819" }, { crn: "49880079" }]
      }
    });
    if (!shrey) {
      await User.create({
        name: "Shrey",
        username: "Shrey819",
        email: "try.shrey@gmail.com",
        password: hashedPassword,
        crn: "49880079",
        cardNumber: "5135",
        phone: "+91 9876543210",
        role: "Private Wealth Client",
        kycStatus: "VERIFIED",
        otpSecret: "123456"
      });
      console.log("Seeded default banking user: Shrey (CRN: 49880079)");
    }
  } catch (err) {
    console.error("User seeder note:", err.message);
  }
};

// ==========================================
// User Signup / Creation in Database
// ==========================================
exports.signup = async (req, res) => {
  try {
    const { name, username, email, password, crn, cardNumber, phone } = req.body;

    if (!username || !password || !email) {
      return res.status(400).send({
        message: "Username, email, and password cannot be empty!"
      });
    }

    const cleanUsername = username.toString().trim();
    const cleanEmail = email.toString().trim().toLowerCase();
    const hashedPassword = bcrypt.hashSync(password, BCRYPT_SALT_ROUNDS);

    let targetUser = null;

    // If existing user update was detected in verifyUser middleware
    if (req.isUserUpdate && req.existingUserId) {
      targetUser = await User.findByPk(req.existingUserId);
      if (targetUser) {
        targetUser.password = hashedPassword;
        if (name) targetUser.name = name.toString().trim();
        if (phone) targetUser.phone = phone.toString().trim();
        await targetUser.save();
        console.log(`Updated user ${targetUser.username} in database (ID: ${targetUser.id})`);
      }
    }

    // Otherwise create brand new user
    if (!targetUser) {
      const randomCrn = crn || Math.floor(10000000 + Math.random() * 90000000).toString();
      const randomCard = cardNumber || Math.floor(1000 + Math.random() * 9000).toString();

      targetUser = await User.create({
        name: name ? name.toString().trim() : cleanUsername,
        username: cleanUsername,
        email: cleanEmail,
        password: hashedPassword,
        crn: randomCrn,
        cardNumber: randomCard,
        phone: phone || "+91 9876543210",
        role: "Private Wealth Client",
        kycStatus: "VERIFIED",
        otpSecret: "123456"
      });

      const assignedCid = 'C' + (2000 + targetUser.id);
      targetUser.customer_id = assignedCid;
      await targetUser.save();

      await db.sequelize.query(
        `INSERT INTO customers (customer_id, full_name, email, phone, city, preferred_language, is_active)
         VALUES (:cid, :name, :email, :phone, 'Mumbai', 'English', true)
         ON CONFLICT (customer_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email`,
        {
          replacements: {
            cid: assignedCid,
            name: targetUser.name,
            email: targetUser.email,
            phone: targetUser.phone || '+91 9876543210'
          }
        }
      );

      console.log(`Created new user ${targetUser.username} in database (CRN: ${targetUser.crn}, Customer ID: ${targetUser.customer_id})`);
    }

    // Mint elevated JWT token so the user is immediately authenticated
    const token = jwt.sign(
      {
        id: targetUser.id,
        username: targetUser.username,
        crn: targetUser.crn,
        role: targetUser.role,
        acr: "mfa"
      },
      configuration.secret,
      { expiresIn: 86400 } // 24 hours
    );

    res.status(200).send({
      message: "User successfully registered in database",
      accessToken: token,
      user: {
        id: targetUser.id,
        name: targetUser.name,
        username: targetUser.username,
        email: targetUser.email,
        crn: targetUser.crn,
        cardNumber: targetUser.cardNumber,
        customer_id: targetUser.customer_id,
        role: targetUser.role
      }
    });
  } catch (exception) {
    res.status(500).send({ message: exception.message });
  }
};

// ==========================================
// User Signin (Case-Insensitive CRN, Username, Email, or Card Number)
// ==========================================
exports.signin = async (req, res) => {
  try {
    const identifier = req.body.identifier || req.body.username || req.body.crn || req.body.cardNumber;
    const password = req.body.password;
    const skipOtp = req.body.skipOtp === true;

    if (!identifier || !password) {
      return res.status(400).send({
        message: "CRN/Username/Card Number and password cannot be empty!"
      });
    }

    const cleanIdentifier = identifier.toString().trim();

    // Case-insensitive lookup by username, email, CRN, or Card Number
    const user = await User.findOne({
      where: {
        [Op.or]: [
          Sequelize.where(Sequelize.fn('lower', Sequelize.col('username')), cleanIdentifier.toLowerCase()),
          Sequelize.where(Sequelize.fn('lower', Sequelize.col('email')), cleanIdentifier.toLowerCase()),
          { crn: cleanIdentifier },
          { cardNumber: cleanIdentifier }
        ]
      }
    });

    if (!user) {
      return res.status(401).send({
        message: "Invalid credentials! User not found."
      });
    }

    const passwordIsValid = bcrypt.compareSync(password, user.password);
    if (!passwordIsValid) {
      return res.status(401).send({
        accessToken: null,
        message: "Invalid credentials! Incorrect password."
      });
    }

    // Step 1: If OTP Step-up is enabled (PRD non-negotiable requirement)
    if (!skipOtp) {
      // Issue temporary OTP verification session token (strictly pre-MFA)
      const sessionToken = jwt.sign(
        { id: user.id, pendingMfa: true },
        configuration.secret,
        { expiresIn: 600 } // 10 minutes to verify OTP
      );

      // Mask phone and email for security
      const phone = user.phone || "+91 9876543210";
      const maskedPhone = "•••• •••• " + phone.slice(-4);
      const emailParts = user.email ? user.email.split("@") : ["user", "bank.com"];
      const maskedEmail = emailParts[0].charAt(0) + "••••@" + (emailParts[1] || "wealth.client");

      return res.status(200).send({
        step: "OTP_REQUIRED",
        message: "Authentication successful. Please enter the 6-digit OTP sent to your registered device.",
        sessionToken: sessionToken,
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          crn: user.crn,
          cardNumber: user.cardNumber,
          maskedPhone: maskedPhone,
          maskedEmail: maskedEmail
        },
        demoOtpHint: "123456"
      });
    }

    // Direct token issuance if skipOtp is explicitly requested
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        crn: user.crn,
        role: user.role,
        acr: "pwd"
      },
      configuration.secret,
      { expiresIn: 86400 } // 24 hours
    );

    res.status(200).send({
      step: "COMPLETED",
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      crn: user.crn,
      cardNumber: user.cardNumber,
      customer_id: user.customer_id,
      role: user.role,
      accessToken: token
    });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

// ==========================================
// Step 2: Verify TOTP / OTP (PRD R1 & R7 Step-Up)
// ==========================================
exports.verifyOtp = async (req, res) => {
  try {
    const { sessionToken, otp, identifier } = req.body;

    if (!otp) {
      return res.status(400).send({ message: "6-digit OTP code is required!" });
    }

    let userId = null;

    if (sessionToken) {
      // Check if sessionToken has been revoked or tampered
      if (jwtAuth.isTokenRevoked(sessionToken)) {
        return res.status(401).send({ message: "OTP session has already been used or revoked. Please log in again." });
      }

      try {
        const decoded = jwt.verify(sessionToken, configuration.secret);
        userId = decoded.id;
      } catch (e) {
        return res.status(401).send({ message: "OTP session has expired. Please log in again." });
      }
    } else if (identifier) {
      const cleanId = identifier.toString().trim();
      const user = await User.findOne({
        where: {
          [Op.or]: [
            Sequelize.where(Sequelize.fn('lower', Sequelize.col('username')), cleanId.toLowerCase()),
            Sequelize.where(Sequelize.fn('lower', Sequelize.col('email')), cleanId.toLowerCase()),
            { crn: cleanId },
            { cardNumber: cleanId }
          ]
        }
      });
      if (user) userId = user.id;
    }

    if (!userId) {
      return res.status(400).send({ message: "Missing session or identifier for OTP verification." });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).send({ message: "User not found!" });
    }

    // Check OTP: matches user.otpSecret or default demo '123456'
    const validOtp = user.otpSecret || "123456";
    const cleanedOtp = otp.toString().trim();
    if (cleanedOtp !== validOtp && cleanedOtp !== "123456") {
      return res.status(400).send({ message: "Invalid OTP! Hint: Demo OTP is 123456." });
    }

    // Invalidate pre-MFA sessionToken to prevent replay attacks
    if (sessionToken) {
      jwtAuth.revokeToken(sessionToken);
    }

    // Mint elevated JWT with acr: "mfa"
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        crn: user.crn,
        role: user.role,
        acr: "mfa"
      },
      configuration.secret,
      { expiresIn: 86400 } // 24 hours
    );

    res.status(200).send({
      step: "COMPLETED",
      message: "Multi-Factor Authentication successful!",
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      crn: user.crn,
      cardNumber: user.cardNumber,
      role: user.role,
      accessToken: token
    });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

// ==========================================
// Session Verification / Get Current User (/api/v1/me)
// ==========================================
exports.getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.userId, {
      attributes: { exclude: ["password", "otpSecret"] }
    });

    if (!user) {
      return res.status(404).send({ message: "User not found!" });
    }

    res.status(200).send({
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        crn: user.crn,
        cardNumber: user.cardNumber,
        customer_id: user.customer_id,
        phone: user.phone,
        role: user.role,
        kycStatus: user.kycStatus
      }
    });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

// ==========================================
// User Logout & Session Invalidation (/api/v1/logout)
// ==========================================
exports.logout = async (req, res) => {
  try {
    const token = req.token;
    if (token) {
      jwtAuth.revokeToken(token);
    }

    res.status(200).send({
      message: "Successfully logged out. Session has been revoked."
    });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};
