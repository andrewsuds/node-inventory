// DECLARATIONS
const express = require("express");
const { Pool, types } = require("pg");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

const port = process.env.PORT || 3001;

// DATABASE
const pool = new Pool({
  connectionString:
    process.env.PRODUCTION === "true"
      ? process.env.INTERNAL
      : process.env.EXTERNAL,
  ssl: process.env.PRODUCTION === "true" ? false : true,
});

types.setTypeParser(types.builtins.NUMERIC, (value) => {
  return parseFloat(value);
});

types.setTypeParser(types.builtins.INT8, (value) => {
  return parseInt(value);
});

// GET
app.get("/all", (req, res) => {
  pool.query("SELECT * FROM product ORDER BY productID DESC", (err, result) => {
    if (err) {
      console.log(err);
      res.json(err.detail);
    }
    if (result) {
      res.json(result.rows);
    }
  });
});

app.get("/allbuy", (req, res) => {
  pool.query(
    "SELECT buyreceiptid, buyprice, buytotal, qty, date, name FROM buyreceipt INNER JOIN product on buyreceipt.productid = product.productid ORDER BY buyreceiptid DESC;",
    (err, result) => {
      if (err) {
        console.log(err);
        res.json(err.detail);
      }
      if (result) {
        res.json(result.rows);
      }
    }
  );
});

app.get("/allsell", (req, res) => {
  pool.query(
    "SELECT sellreceiptid, sellprice, buyprice, selltotal, buytotal, profit, qty, date, name FROM sellreceipt INNER JOIN product on sellreceipt.productid = product.productid ORDER BY sellreceiptid DESC;",
    (err, result) => {
      if (err) {
        console.log(err);
        res.json(err.detail);
      }
      if (result) {
        res.json(result.rows);
      }
    }
  );
});

app.get("/statistic", (req, res) => {
  pool.query(
    "SELECT SUM(profit) as profit, SUM(qty) as qty FROM sellreceipt;",
    (err, result) => {
      if (err) {
        console.log(err);
        res.json(err.detail);
      }
      if (result) {
        res.json(result.rows[0]);
      }
    }
  );
});

// POST
app.post("/product", (req, res) => {
  const name = req.body.name;
  const value = 0;
  const qtyOnHand = 0;

  pool.query(
    "INSERT INTO product(name, value, qtyonhand) VALUES($1, $2, $3) RETURNING productid;",
    [name, value, qtyOnHand],
    (err, result) => {
      if (err) {
        console.log(err);
        res.json({ message: err.detail });
      }
      if (result) {
        res.json({
          productid: result.rows[0].productid,
          message: "Success",
        });
      }
    }
  );
});

app.post("/buy", async (req, res) => {
  const buyTotal = req.body.buytotal;
  const qty = req.body.qty;
  const productID = req.body.productid;

  const buyPrice = buyTotal / qty;

  try {
    const result = await pool.query(
      "INSERT INTO buyreceipt(buyprice, qty, buytotal, date, productid) VALUES($1,$2,$3,CURRENT_DATE,$4) RETURNING buyreceiptid;",
      [buyPrice, qty, buyTotal, productID]
    );

    await pool.query(
      "UPDATE product SET value = value+$1, qtyOnHand = qtyOnHand+$2 WHERE productID = $3;",
      [buyTotal, qty, productID]
    );

    res.json({
      buyreceiptid: result.rows[0].buyreceiptid,
      message: "Success",
    });
  } catch (err) {
    console.log(err);
    res.json({ message: err.detail });
  }
});

app.post("/sell", async (req, res) => {
  const productID = req.body.productid;
  const sellTotal = req.body.selltotal;
  const qty = req.body.qty;
  let buyPrice;
  let buyTotal;
  let sellPrice;
  let profit;

  try {
    const product = await pool.query(
      "SELECT value, qtyonhand FROM product WHERE productid = $1",
      [productID]
    );

    if (product.rowCount > 0) {
      buyPrice = product.rows[0].value / product.rows[0].qtyonhand;
      buyTotal = (product.rows[0].value / product.rows[0].qtyonhand) * qty;
      sellPrice = sellTotal / qty;
      profit = sellTotal - buyTotal;
    } else {
      return res.json({ message: "Product not found" });
    }

    const result = await pool.query(
      "INSERT INTO sellreceipt(sellprice, buyprice, selltotal, buytotal, profit, qty, date, productID) VALUES($1,$2,$3,$4,$5,$6,CURRENT_DATE,$7) RETURNING sellreceiptid;",
      [sellPrice, buyPrice, sellTotal, buyTotal, profit, qty, productID]
    );

    await pool.query(
      "UPDATE product SET value = value-$1, qtyOnHand = qtyOnHand-$2 WHERE productID = $3;",
      [buyTotal, qty, productID]
    );

    res.json({
      sellreceiptid: result.rows[0].sellreceiptid,
      message: "Success",
    });
  } catch (err) {
    console.log(err);
    res.json({ message: err.detail });
  }
});

// DELETE
app.post("/delproduct", async (req, res) => {
  const productid = req.body.productid;

  try {
    await pool.query("DELETE FROM buyreceipt WHERE productid = $1;", [
      productid,
    ]);
    await pool.query("DELETE FROM sellreceipt WHERE productid = $1;", [
      productid,
    ]);
    await pool.query("DELETE FROM product WHERE productid = $1;", [productid]);

    res.json({ message: "Deleted Successfully" });
  } catch (err) {
    res.json({ message: err.detail });
  }
});

// CREATE
app.listen(port, () => {
  console.log("Server running");
});
