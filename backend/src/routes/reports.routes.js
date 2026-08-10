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

// GET /api/reports/sales?from=&to=
// Combines POS sales (transactions) with completed Orders (status = 'successful').
// Pending, cancelled, and returned orders are intentionally excluded.
router.get("/sales", async (req, res) => {
  const { from, to } = req.query;

  let txQuery = `SELECT t.*, p.name AS product_name, p.code AS product_code
                 FROM transactions t JOIN products p ON p.id = t.product_id
                 WHERE t.type = 'sale'`;
  const txParams = [];
  if (from) {
    txParams.push(from);
    txQuery += ` AND t.created_at::date >= $${txParams.length}::date`;
  }
  if (to) {
    txParams.push(to);
    txQuery += ` AND t.created_at::date <= $${txParams.length}::date`;
  }
  txQuery += " ORDER BY t.created_at DESC";

  let orderQuery = `SELECT * FROM orders WHERE status = 'successful'`;
  const orderParams = [];
  if (from) {
    orderParams.push(from);
    orderQuery += ` AND created_at::date >= $${orderParams.length}::date`;
  }
  if (to) {
    orderParams.push(to);
    orderQuery += ` AND created_at::date <= $${orderParams.length}::date`;
  }
  orderQuery += " ORDER BY created_at DESC";

  try {
    const [txResult, orderResult] = await Promise.all([
      pool.query(txQuery, txParams),
      pool.query(orderQuery, orderParams),
    ]);

    const posSales = txResult.rows.map((s) => ({
      id: `txn-${s.id}`,
      source: "pos",
      product_name: s.product_name,
      product_code: s.product_code,
      customer_name: null,
      quantity: s.quantity,
      unit_price: Number(s.unit_price),
      total: Number(s.total),
      created_at: s.created_at,
    }));

    // Look up current selling price for every product referenced by a completed order
    const productIds = new Set();
    orderResult.rows.forEach((o) => {
      (o.products || []).forEach((line) => {
        const pid = line.productId || line.itemId || line.id;
        if (pid) productIds.add(Number(pid));
      });
    });

    let priceMap = {};
    if (productIds.size > 0) {
      const { rows: priceRows } = await pool.query(
        "SELECT id, code, name, price FROM products WHERE id = ANY($1::int[])",
        [Array.from(productIds)]
      );
      priceRows.forEach((p) => {
        priceMap[p.id] = { code: p.code, name: p.name, price: Number(p.price) };
      });
    }

    const orderSales = [];
    orderResult.rows.forEach((o) => {
      (o.products || []).forEach((line, idx) => {
        const pid = Number(line.productId || line.itemId || line.id);
        const qty = Number(line.qty) || 0;
        if (!pid || qty <= 0) return;
        const meta = priceMap[pid];
        // Fall back to the order line's stored cost only if the product was deleted since
        const unitPrice = meta ? meta.price : Number(line.cost) || 0;
        orderSales.push({
          id: `order-${o.id}-${idx}`,
          source: "order",
          product_name: meta ? meta.name : line.name,
          product_code: meta ? meta.code : null,
          customer_name: o.customer_name,
          quantity: qty,
          unit_price: unitPrice,
          total: unitPrice * qty,
          created_at: o.created_at,
        });
      });
    });

    const sales = [...posSales, ...orderSales].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

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