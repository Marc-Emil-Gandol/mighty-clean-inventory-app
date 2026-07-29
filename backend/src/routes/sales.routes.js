const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// GET /api/sales -> recent sale transactions
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, p.name AS product_name, p.code AS product_code, u.name AS staff_name
       FROM transactions t
       JOIN products p ON p.id = t.product_id
       LEFT JOIN users u ON u.id = t.staff_id
       WHERE t.type = 'sale'
       ORDER BY t.created_at DESC
       LIMIT 200`
    );
    res.json(rows.map((r) => ({ ...r, unit_price: Number(r.unit_price), total: Number(r.total) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load sales" });
  }
});

// GET /api/sales/lookup/:code -> resolve a scanned/typed code to a product
router.get("/lookup/:code", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM products WHERE code = $1", [req.params.code]);
  const product = rows[0];
  if (!product) return res.status(404).json({ error: "No product matches that code" });
  res.json({ ...product, cost: Number(product.cost), price: Number(product.price) });
});

// POST /api/sales -> record a sale (decrements stock)
router.post("/", requireRole("admin", "sales_staff"), async (req, res) => {
  const { code, quantity, customerId } = req.body;
  const qty = Number(quantity);

  if (!code || !qty || qty <= 0) {
    return res.status(400).json({ error: "A product code and positive quantity are required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: productRows } = await client.query("SELECT * FROM products WHERE code = $1", [code]);
    const product = productRows[0];
    if (!product) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "No product matches that code" });
    }
    if (product.stock < qty) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `Only ${product.stock} in stock` });
    }

    const total = qty * product.price;

    await client.query("UPDATE products SET stock = stock - $1 WHERE id = $2", [qty, product.id]);
    const { rows } = await client.query(
      `INSERT INTO transactions (type, product_id, quantity, unit_price, total, staff_id, customer_id)
       VALUES ('sale', $1, $2, $3, $4, $5, $6) RETURNING *`,
      [product.id, qty, product.price, total, req.user.id, customerId || null]
    );

    await client.query("COMMIT");
    const created = rows[0];
    res.status(201).json({ ...created, unit_price: Number(created.unit_price), total: Number(created.total) });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Could not record sale" });
  } finally {
    client.release();
  }
});

module.exports = router;
