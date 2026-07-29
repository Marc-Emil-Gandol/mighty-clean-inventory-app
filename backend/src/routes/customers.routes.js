const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM customers ORDER BY name ASC");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load customers" });
  }
});

router.post("/", async (req, res) => {
  const { name, contact } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });
  try {
    const { rows } = await pool.query(
      "INSERT INTO customers (name, contact) VALUES ($1, $2) RETURNING *",
      [name, contact || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create customer" });
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
