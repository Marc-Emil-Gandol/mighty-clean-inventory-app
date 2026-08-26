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

// Combines the scan-and-sell "transactions" table with completed orders,
// so completed orders show up in the Sales Report too.
router.get("/sales", async (req, res) => {
  const { from, to } = req.query;

  let query = `
    WITH sales_data AS (
      SELECT
        t.id::text AS row_id,
        p.name AS product_name,
        p.code AS product_code,
        t.quantity,
        t.unit_price::numeric AS unit_price,
        t.total::numeric AS total,
        t.created_at
      FROM transactions t
      JOIN products p ON p.id = t.product_id
      WHERE t.type = 'sale'

      UNION ALL

      SELECT
        ('order-' || o.id || '-' || ord.ordinality)::text AS row_id,
        COALESCE(p.name, ord.line->>'name') AS product_name,
        p.code AS product_code,
        COALESCE((ord.line->>'qty')::int, 0) AS quantity,
        COALESCE((ord.line->>'cost')::numeric, 0) AS unit_price,
        (COALESCE((ord.line->>'cost')::numeric, 0) * COALESCE((ord.line->>'qty')::int, 0))::numeric AS total,
        o.created_at
      FROM orders o
      CROSS JOIN LATERAL jsonb_array_elements(o.products) WITH ORDINALITY AS ord(line, ordinality)
      LEFT JOIN products p ON p.id = NULLIF(ord.line->>'productId', '')::int
      WHERE o.status = 'successful'
    )
    SELECT * FROM sales_data WHERE 1=1
  `;
  const params = [];
  if (from) {
    params.push(from);
    query += ` AND created_at::date >= $${params.length}::date`;
  }
  if (to) {
    params.push(to);
    query += ` AND created_at::date <= $${params.length}::date`;
  }
  query += " ORDER BY created_at DESC";

  try {
    const { rows } = await pool.query(query, params);
    const sales = rows.map((s) => ({
      id: s.row_id,
      product_name: s.product_name,
      product_code: s.product_code,
      quantity: s.quantity,
      unit_price: Number(s.unit_price),
      total: Number(s.total),
      created_at: s.created_at,
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