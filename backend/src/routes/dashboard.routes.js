const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const totalProducts = (await pool.query("SELECT COUNT(*)::int AS n FROM products")).rows[0].n;

    const lowStockCount = (
      await pool.query("SELECT COUNT(*)::int AS n FROM products WHERE stock <= low_stock_threshold")
    ).rows[0].n;

    const inventoryValue = (
      await pool.query("SELECT COALESCE(SUM(cost * stock), 0) AS v FROM products")
    ).rows[0].v;

    const todaySales = (
      await pool.query(
        `SELECT COALESCE(SUM(total), 0) AS total, COALESCE(SUM(quantity), 0)::int AS units
         FROM transactions
         WHERE type = 'sale' AND created_at::date = CURRENT_DATE`
      )
    ).rows[0];

    const salesByDayRows = (
      await pool.query(
        `SELECT created_at::date AS day, SUM(total) AS total
         FROM transactions
         WHERE type = 'sale' AND created_at >= NOW() - INTERVAL '6 days'
         GROUP BY day
         ORDER BY day ASC`
      )
    ).rows;

    const lowStockItems = (
      await pool.query(
        "SELECT id, code, name, stock, low_stock_threshold FROM products WHERE stock <= low_stock_threshold"
      )
    ).rows;

    // Recent sale/return transactions
    const recentTransactionRows = (
      await pool.query(
        `SELECT t.*, p.name AS product_name
         FROM transactions t JOIN products p ON p.id = t.product_id
         ORDER BY t.created_at DESC LIMIT 8`
      )
    ).rows;

    // Recent orders activity (created via the Orders tab)
    const recentOrderRows = (
      await pool.query(
        `SELECT id, customer_name, total_cost, total_qty, status, created_at
         FROM orders
         ORDER BY created_at DESC LIMIT 8`
      )
    ).rows;

    const recentActivity = [
      ...recentTransactionRows.map((t) => ({
        id: `txn-${t.id}`,
        type: t.type, // 'sale' | 'return'
        status: null,
        description: t.product_name,
        quantity: t.quantity,
        total: Number(t.total),
        createdAt: t.created_at,
      })),
      ...recentOrderRows.map((o) => ({
        id: `order-${o.id}`,
        type: "order",
        status: o.status, // 'pending' | 'successful' | 'cancelled' | 'returned'
        description: o.customer_name,
        quantity: o.total_qty,
        total: Number(o.total_cost),
        createdAt: o.created_at,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 8);

    res.json({
      totalProducts,
      lowStockCount,
      inventoryValue: Number(inventoryValue),
      todaySalesTotal: Number(todaySales.total),
      todaySalesUnits: todaySales.units,
      salesByDay: salesByDayRows.map((d) => ({
        day: d.day.toISOString().slice(0, 10),
        total: Number(d.total),
      })),
      lowStockItems,
      recentActivity,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load dashboard data" });
  }
});

module.exports = router;
