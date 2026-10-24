module.exports = (sequelize, Sequelize) => {
  const User = sequelize.define("user", {
    customer_id: {
      type: Sequelize.STRING,
      defaultValue: "C1001"
    },
    name: {
      type: Sequelize.STRING,
      defaultValue: "Elena Rostova"
    },
    username: {
      type: Sequelize.STRING
    },
    email: {
      type: Sequelize.STRING
    },
    password: {
      type: Sequelize.STRING
    },
    crn: {
      type: Sequelize.STRING,
      defaultValue: "98234105"
    },
    cardNumber: {
      type: Sequelize.STRING,
      defaultValue: "4441"
    },
    phone: {
      type: Sequelize.STRING,
      defaultValue: "+91 9876543210"
    },
    role: {
      type: Sequelize.STRING,
      defaultValue: "Private Wealth Client"
    },
    kycStatus: {
      type: Sequelize.STRING,
      defaultValue: "VERIFIED"
    },
    otpSecret: {
      type: Sequelize.STRING,
      defaultValue: "123456"
    }
  });

  return User;
};
