const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, p.name AS product_name, p.code AS product_code, u.name AS staff_name
       FROM transactions t
       JOIN products p ON p.id = t.product_id
       LEFT JOIN users u ON u.id = t.staff_id
       WHERE t.type = 'return'
       ORDER BY t.created_at DESC
       LIMIT 200`
    );
    res.json(rows.map((r) => ({ ...r, unit_price: Number(r.unit_price), total: Number(r.total) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load returns" });
  }
});

router.post("/", requireRole("admin", "inventory_staff", "sales_staff"), async (req, res) => {
  const { code, quantity, reason } = req.body;
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

    const total = qty * product.price;

    await client.query("UPDATE products SET stock = stock + $1 WHERE id = $2", [qty, product.id]);
    const { rows } = await client.query(
      `INSERT INTO transactions (type, product_id, quantity, unit_price, total, reason, staff_id)
       VALUES ('return', $1, $2, $3, $4, $5, $6) RETURNING *`,
      [product.id, qty, product.price, total, reason || null, req.user.id]
    );

    await client.query("COMMIT");
    const created = rows[0];
    res.status(201).json({ ...created, unit_price: Number(created.unit_price), total: Number(created.total) });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Could not process return" });
  } finally {
    client.release();
  }
});

module.exports = router;
