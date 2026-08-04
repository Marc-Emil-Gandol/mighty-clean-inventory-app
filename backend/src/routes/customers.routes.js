const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

function serializeOrder(row) {
  return {
    id: row.id,
    customer: row.customer_name,
    handoverDate: row.handover_date,
    products: row.products || [],
    totalCost: Number(row.total_cost),
    totalQty: row.total_qty,
    status: row.status,
    createdAt: row.created_at,
  };
}

router.get("/", async (req, res) => {
  const { search } = req.query;
  try {
    let query = "SELECT * FROM customers WHERE 1=1";
    const params = [];
    if (search) {
      params.push(`%${search}%`, `%${search}%`);
      query += ` AND (name ILIKE $${params.length - 1} OR contact ILIKE $${params.length})`;
    }
    query += " ORDER BY name ASC";
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load customers" });
  }
});

router.get("/:id/orders", async (req, res) => {
  try {
    const { rows: customerRows } = await pool.query("SELECT * FROM customers WHERE id = $1", [
      req.params.id,
    ]);
    if (!customerRows[0]) return res.status(404).json({ error: "Customer not found" });

    const customer = customerRows[0];
    const { rows } = await pool.query(
      `SELECT * FROM orders
       WHERE customer_id = $1 OR LOWER(customer_name) = LOWER($2)
       ORDER BY created_at DESC`,
      [customer.id, customer.name]
    );
    res.json(rows.map(serializeOrder));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load customer orders" });
  }
});

router.post("/", async (req, res) => {
  const { name, contact } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });
  try {
    const { rows } = await pool.query(
      "INSERT INTO customers (name, contact) VALUES ($1, $2) RETURNING *",
      [name.trim(), contact || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create customer" });
  }
});

router.put("/:id", async (req, res) => {
  const { name, contact } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "Name is required" });
  }
  try {
    const { rows } = await pool.query(
      "UPDATE customers SET name = $1, contact = $2 WHERE id = $3 RETURNING *",
      [name.trim(), contact || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Customer not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update customer" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM customers WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Customer not found" });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete customer" });
  }
});

module.exports = router;
