const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

const PERIODS = {
  daily: { trunc: "day", interval: "6 days" },
  weekly: { trunc: "week", interval: "11 weeks" },
  monthly: { trunc: "month", interval: "11 months" },
  yearly: { trunc: "year", interval: "4 years" },
};

router.get("/", async (req, res) => {
  try {
    const period = PERIODS[req.query.period] ? req.query.period : "daily";
    const { trunc, interval } = PERIODS[period];

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
        `SELECT date_trunc($1, created_at) AS day, SUM(total) AS total
         FROM transactions
         WHERE type = 'sale' AND created_at >= NOW() - $2::interval
         GROUP BY day
         ORDER BY day ASC`,
        [trunc, interval]
      )
    ).rows;

    const lowStockItems = (
      await pool.query(
        "SELECT id, code, name, stock, low_stock_threshold FROM products WHERE stock <= low_stock_threshold"
      )
    ).rows;

    const recentSales = (
      await pool.query(
        `SELECT t.*, p.name AS product_name
         FROM transactions t JOIN products p ON p.id = t.product_id
         WHERE t.type = 'sale'
         ORDER BY t.created_at DESC LIMIT 8`
      )
    ).rows;

    res.json({
      totalProducts,
      lowStockCount,
      inventoryValue: Number(inventoryValue),
      todaySalesTotal: Number(todaySales.total),
      todaySalesUnits: todaySales.units,
      period,
      salesByDay: salesByDayRows.map((d) => ({
        day: d.day.toISOString().slice(0, 10),
        total: Number(d.total),
      })),
      lowStockItems,
      recentSales: recentSales.map((t) => ({
        ...t,
        unit_price: Number(t.unit_price),
        total: Number(t.total),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load dashboard data" });
  }
});

module.exports = router;