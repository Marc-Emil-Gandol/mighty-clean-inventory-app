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

async function buildDisplayNumberMap() {
  const { rows } = await pool.query("SELECT id FROM orders ORDER BY created_at ASC, id ASC");
  const map = {};
  rows.forEach((row, i) => {
    map[row.id] = 1001 + i;
  });
  return map;
}

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
        `SELECT COALESCE(SUM(total_cost), 0) AS total, COALESCE(SUM(total_qty), 0)::int AS units
         FROM orders
         WHERE status = 'successful' AND completed_at::date = CURRENT_DATE`
      )
    ).rows[0];

    const salesByDayRows = (
      await pool.query(
        `SELECT date_trunc($1, completed_at) AS day, SUM(total_cost) AS total
         FROM orders
         WHERE status = 'successful'
           AND completed_at IS NOT NULL
           AND completed_at >= NOW() - $2::interval
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

    const recentSalesRows = (
      await pool.query(
        `SELECT id, customer_name, total_qty, total_cost, completed_at
         FROM orders
         WHERE status = 'successful' AND completed_at IS NOT NULL
         ORDER BY completed_at DESC
         LIMIT 8`
      )
    ).rows;

    const numMap = await buildDisplayNumberMap();

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
      recentSales: recentSalesRows.map((row) => ({
        id: row.id,
        displayNumber: numMap[row.id] || row.id,
        customer: row.customer_name,
        totalQty: row.total_qty,
        totalCost: Number(row.total_cost),
        completedAt: row.completed_at,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load dashboard data" });
  }
});

module.exports = router;
