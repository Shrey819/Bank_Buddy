const database = require("../models");
const configuration = require("../config/config-jwt.js");
const User = database.user;

var jwt = require("jsonwebtoken");
var bcrypt = require("bcryptjs");

exports.signup = (req, res) => {
  console.log("Request : ", req.body);
  if (!req.body || !req.body.username || !req.body.password || !req.body.email) {
    return res.status(400).send({
      message: "Username, email, and password cannot be empty!"
    });
  }

  User.create({
    username: req.body.username,
    email: req.body.email,
    password: bcrypt.hashSync(req.body.password, 8)
  })
  .then(() => {
    res.status(200).send({ message: "User successfully registered" });
  })
  .catch(exception => {
    res.status(500).send({ message: exception.message });
  });
};

exports.signin = (req, res) => {
  if (!req.body || !req.body.username || !req.body.password) {
    return res.status(400).send({
      message: "Username and password cannot be empty!"
    });
  }

  User.findOne({
    where: {
      username: req.body.username
    }
  })
  .then(user => {
    if (!user) {
      return res.status(404).send({ 
          message: "User not found" });
    }

    var passwordIsValid = bcrypt.compareSync(req.body.password, user.password);
    if (!passwordIsValid) {
        return res.status(401).send({
            accessToken: null,
            message: "Invalid password!"
        });
    }

    // Set token expiration (24 hours)
    var token = jwt.sign({ 
      id: user.id, 
      customer_id: user.customer_id || `USER-${user.id}` 
    }, configuration.secret, {
      expiresIn: 86400
    });

    res.status(200).send({
      id: user.id,
      username: user.username,
      email: user.email,
      accessToken: token
    });
  })
  .catch(err => {
    res.status(500).send({ message: err.message });
  });
};
