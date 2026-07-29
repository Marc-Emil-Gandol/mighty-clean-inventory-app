const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/inventory", async (req, res) => {
  try {
    const { rows: products } = await pool.query("SELECT * FROM products ORDER BY category, name");
    const normalized = products.map((p) => ({ ...p, cost: Number(p.cost), price: Number(p.price) }));
    const totalValue = normalized.reduce((sum, p) => sum + p.cost * p.stock, 0);
    res.json({
      generatedAt: new Date().toISOString(),
      totalProducts: normalized.length,
      totalValue,
      products: normalized,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not generate inventory report" });
  }
});

router.get("/sales", async (req, res) => {
  const { from, to } = req.query;
  let query = `SELECT t.*, p.name AS product_name, p.code AS product_code
               FROM transactions t JOIN products p ON p.id = t.product_id
               WHERE t.type = 'sale'`;
  const params = [];
  if (from) {
    params.push(from);
    query += ` AND t.created_at::date >= $${params.length}::date`;
  }
  if (to) {
    params.push(to);
    query += ` AND t.created_at::date <= $${params.length}::date`;
  }
  query += " ORDER BY t.created_at DESC";

  try {
    const { rows } = await pool.query(query, params);
    const sales = rows.map((s) => ({ ...s, unit_price: Number(s.unit_price), total: Number(s.total) }));
    const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
    const totalUnits = sales.reduce((sum, s) => sum + s.quantity, 0);

    res.json({
      generatedAt: new Date().toISOString(),
      range: { from: from || null, to: to || null },
      totalRevenue,
      totalUnits,
      sales,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not generate sales report" });
  }
});

module.exports = router;
