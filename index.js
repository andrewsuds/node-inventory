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
  ssl: true,
});

types.setTypeParser(types.builtins.NUMERIC, (value) => {
  return parseFloat(value);
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
    "SELECT * FROM buyreceipt ORDER BY productID DESC",
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
    "SELECT * FROM sellreceipt ORDER BY productID DESC",
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

app.post("/buy", (req, res) => {
  const buyTotal = req.body.buytotal;
  const qty = req.body.qty;
  const productID = req.body.productid;

  const buyPrice = buyTotal / qty;

  pool.query(
    "UPDATE product SET value = value+$1, qtyOnHand = qtyOnHand+$2 WHERE productID = $3;",
    [buyTotal, qty, productID],
    (err, result) => {
      if (err) {
        console.log(err);
      }
    }
  );

  pool.query(
    "INSERT INTO buyreceipt(buyprice, qty, buytotal, date, productid) VALUES($1,$2,$3,CURRENT_DATE,$4) RETURNING buyreceiptid;",
    [buyPrice, qty, buyTotal, productID],
    (err, result) => {
      if (err) {
        console.log(err);
        res.json({ message: err.detail });
      }
      if (result) {
        res.json({
          buyreceiptid: result.rows[0].buyreceiptid,
          message: "Success",
        });
      }
    }
  );
});

app.post("/sell", async (req, res) => {
  const productID = req.body.productid;
  const sellTotal = req.body.selltotal;
  const qty = req.body.qty;

  const product = await pool.query(
    "SELECT value, qtyonhand FROM product WHERE productid = $1",
    [productID]
  );

  const buyPrice = product.rows[0].value / product.rows[0].qtyonhand;
  const buyTotal = (product.rows[0].value / product.rows[0].qtyonhand) * qty;
  const sellPrice = sellTotal / qty;
  const profit = sellTotal - buyTotal;

  pool.query(
    "UPDATE product SET value = value-$1, qtyOnHand = qtyOnHand-$2 WHERE productID = $3;",
    [buyTotal, qty, productID],
    (err, result) => {
      if (err) {
        console.log(err.detail);
      }
    }
  );

  pool.query(
    "INSERT INTO sellreceipt(sellprice, buyprice, selltotal, buytotal, profit, qty, date, productID) VALUES($1,$2,$3,$4,$5,$6,CURRENT_DATE,$7) RETURNING sellreceiptid;",
    [sellPrice, buyPrice, sellTotal, buyTotal, profit, qty, productID],
    (err, result) => {
      if (err) {
        console.log(err);
        res.json({ message: err.detail });
      }
      if (result) {
        res.json({
          sellreceiptid: result.rows[0].sellreceiptid,
          message: "Success",
        });
      }
    }
  );
});

// CREATE
app.listen(port, () => {
  console.log("Server running");
});
