const express = require("express");
const QRCode = require("qrcode");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

function serialize(p) {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    category: p.category,
    cost: Number(p.cost),
    price: Number(p.price),
    stock: p.stock,
    lowStockThreshold: p.low_stock_threshold,
    isLow: p.stock <= p.low_stock_threshold,
  };
}

// GET /api/inventory?search=&category=
router.get("/", async (req, res) => {
  const { search, category } = req.query;
  let query = "SELECT * FROM products WHERE 1=1";
  const params = [];

  if (search) {
    params.push(`%${search}%`, `%${search}%`);
    query += ` AND (name ILIKE $${params.length - 1} OR code ILIKE $${params.length})`;
  }
  if (category && category !== "All Categories") {
    params.push(category);
    query += ` AND category = $${params.length}`;
  }
  query += " ORDER BY id ASC";

  try {
    const { rows } = await pool.query(query, params);
    res.json(rows.map(serialize));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load inventory" });
  }
});

router.get("/categories", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT DISTINCT category FROM products ORDER BY category");
    res.json(rows.map((r) => r.category));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load categories" });
  }
});

router.get("/:id", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM products WHERE id = $1", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Product not found" });
  res.json(serialize(rows[0]));
});

// Inventory staff + admin can add / edit / delete
router.post("/", requireRole("admin", "inventory_staff"), async (req, res) => {
  const { code, name, category, cost, price, stock, lowStockThreshold } = req.body;
  if (!code || !name || !category) {
    return res.status(400).json({ error: "Code, name, and category are required" });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO products (code, name, category, cost, price, stock, low_stock_threshold)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [code, name, category, cost || 0, price || 0, stock || 0, lowStockThreshold || 5]
    );
    res.status(201).json(serialize(rows[0]));
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "A product with that code already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not create product" });
  }
});

router.put("/:id", requireRole("admin", "inventory_staff"), async (req, res) => {
  const { rows: existingRows } = await pool.query("SELECT * FROM products WHERE id = $1", [
    req.params.id,
  ]);
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: "Product not found" });

  const {
    code = existing.code,
    name = existing.name,
    category = existing.category,
    cost = existing.cost,
    price = existing.price,
    stock = existing.stock,
    lowStockThreshold = existing.low_stock_threshold,
  } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE products SET code=$1, name=$2, category=$3, cost=$4, price=$5, stock=$6, low_stock_threshold=$7
       WHERE id=$8 RETURNING *`,
      [code, name, category, cost, price, stock, lowStockThreshold, req.params.id]
    );
    res.json(serialize(rows[0]));
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "A product with that code already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not update product" });
  }
});

router.delete("/:id", requireRole("admin", "inventory_staff"), async (req, res) => {
  const result = await pool.query("DELETE FROM products WHERE id = $1", [req.params.id]);
  if (result.rowCount === 0) return res.status(404).json({ error: "Product not found" });
  res.json({ success: true });
});

// GET /api/inventory/:id/qrcode -> data URL PNG encoding the product code
router.get("/:id/qrcode", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM products WHERE id = $1", [req.params.id]);
  const product = rows[0];
  if (!product) return res.status(404).json({ error: "Product not found" });

  try {
    const payload = JSON.stringify({ code: product.code, id: product.id, name: product.name });
    const dataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 300 });
    res.json({ dataUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not generate QR code" });
  }
});

module.exports = router;
