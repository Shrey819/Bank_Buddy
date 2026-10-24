const db = require("../models");
const Product = db.product;

// Add new product
exports.create = (req, res) => {
  console.log("Request : ", req.body);
  if (!req.body || !req.body.name || req.body.price === undefined) {
    return res.status(400).send({
      message: "Product name and price are required!"
    });
  }

  const product = {
    name: req.body.name,
    price: req.body.price,
    isDeleted: req.body.isDeleted ? req.body.isDeleted : false
  };

  Product.create(product)
    .then(data => {
      res.status(201).send(data);
    })
    .catch(err => {
      res.status(500).send({
        message: err.message || "Error when add a product!"
      });
    });
};

// Find all products
exports.findAll = (req, res) => {
  Product.findAll({ where: { isDeleted: false }, order: [['id', 'ASC']] })
    .then(data => {
      res.status(200).send(data);
    })
    .catch(err => {
      res.status(500).send({
        message: err.message || "Error when get all product!"
      });
    });
};

// Find product by product id
exports.findOne = (req, res) => {
  console.log("Request : ", req.body);
  const id = req.body.id || req.params.id;

  if (!id) {
    return res.status(400).send({
      message: "Product id is required!"
    });
  }

  Product.findByPk(id)
    .then(data => {
      if (data && !data.isDeleted) {
        res.status(200).send(data);
      } else {
        res.status(404).send({
          message: "Product not found!"
        });
      }
    })
    .catch(err => {
      res.status(500).send({
        message: "Error when get product by product id : " + id
      });
    });
};

// Update product by product id
exports.update = (req, res) => {
  console.log("Request : ", req.body);
  const id = req.body.id || req.params.id;

  if (!id) {
    return res.status(400).send({
      message: "Product id is required!"
    });
  }

  Product.update(req.body, {
    where: { id: id }
  })
    .then(([num]) => {
      if (num === 1) {
        res.status(200).send({
          message: "Product successfully updated."
        });
      } else {
        res.status(404).send({
          message: "Update process failed. Product not found."
        });
      }
    })
    .catch(err => {
      res.status(500).send({
        message: "Error updating product with product id : " + id
      });
    });
};

// Delete product by product id
exports.delete = (req, res) => {
  console.log("Request : ", req.body);
  const id = req.body.id || req.params.id;

  if (!id) {
    return res.status(400).send({
      message: "Product id is required!"
    });
  }

  Product.destroy({
    where: { id: id }
  })
    .then(num => {
      if (num === 1) {
        res.status(200).send({
          message: "Product successfully deleted."
        });
      } else {
        res.status(404).send({
          message: "Delete process failed. Product not found."
        });
      }
    })
    .catch(err => {
      res.status(500).send({
        message: "Couldn't delete product with product id : " + id
      });
    });
};
