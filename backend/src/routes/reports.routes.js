const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { logActivity } = require("../utils/activityLog");

const router = express.Router();
router.use(requireAuth);

async function getPendingOutgoingMap() {
  const { rows } = await pool.query("SELECT products FROM orders WHERE status = 'pending'");
  const map = {};
  rows.forEach((row) => {
    (row.products || []).forEach((line) => {
      const pid = line.productId || line.itemId || line.id;
      const qty = Number(line.qty);
      if (!pid || !Number.isFinite(qty) || qty <= 0) return;
      map[pid] = (map[pid] || 0) + qty;
    });
  });
  return map;
}

router.get("/inventory", async (req, res) => {
  try {
    const { rows: products } = await pool.query("SELECT * FROM products ORDER BY category, name");
    const outgoingMap = await getPendingOutgoingMap();
    const normalized = products.map((p) => {
      const outgoing = outgoingMap[p.id] || 0;
      return {
        ...p,
        cost: Number(p.cost),
        price: Number(p.price),
        outgoing,
        available: p.stock - outgoing,
      };
    });
    const totalValue = normalized.reduce((sum, p) => sum + p.cost * p.stock, 0);

    const report = {
      generatedAt: new Date().toISOString(),
      generatedBy: req.user.name,
      totalProducts: normalized.length,
      totalValue,
      products: normalized,
    };

    await logActivity({
      actorId: req.user.id,
      actorName: req.user.name,
      action: "Generated inventory report",
      entityType: "report",
      entityLabel: "Inventory Report",
      details: `${normalized.length} products`,
      reportType: "inventory_report",
      metadata: report,
    });

    res.json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not generate inventory report" });
  }
});

router.get("/sales", async (req, res) => {
  const { from, to } = req.query;
  let query = `
    SELECT
      o.id,
      o.customer_name,
      o.completed_at AS created_at,
      line->>'name' AS product_name,
      p.code AS product_code,
      (line->>'qty')::int AS quantity,
      (line->>'cost')::double precision AS unit_price,
      ((line->>'qty')::int * (line->>'cost')::double precision) AS total
    FROM orders o
    CROSS JOIN LATERAL jsonb_array_elements(o.products) AS line
    LEFT JOIN products p ON p.id = COALESCE(
      NULLIF(line->>'productId', '')::int,
      NULLIF(line->>'itemId', '')::int,
      NULLIF(line->>'id', '')::int
    )
    WHERE o.status = 'successful' AND o.completed_at IS NOT NULL`;
  const params = [];
  if (from) {
    params.push(from);
    query += ` AND o.completed_at::date >= $${params.length}::date`;
  }
  if (to) {
    params.push(to);
    query += ` AND o.completed_at::date <= $${params.length}::date`;
  }
  query += " ORDER BY o.completed_at DESC, o.id DESC";

  try {
    const { rows } = await pool.query(query, params);
    const sales = rows.map((s) => ({
      ...s,
      unit_price: Number(s.unit_price),
      total: Number(s.total),
    }));
    const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
    const totalUnits = sales.reduce((sum, s) => sum + s.quantity, 0);

    const report = {
      generatedAt: new Date().toISOString(),
      generatedBy: req.user.name,
      range: { from: from || null, to: to || null },
      totalRevenue,
      totalUnits,
      sales,
    };

    await logActivity({
      actorId: req.user.id,
      actorName: req.user.name,
      action: "Generated sales report",
      entityType: "report",
      entityLabel: "Sales Report",
      details: from || to ? `${from || "…"} to ${to || "…"}` : "All time",
      reportType: "sales_report",
      metadata: report,
    });

    res.json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not generate sales report" });
  }
});

module.exports = router;