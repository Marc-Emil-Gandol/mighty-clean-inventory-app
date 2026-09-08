const express = require("express");
const QRCode = require("qrcode");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { logActivity } = require("../utils/activityLog");

const router = express.Router();
router.use(requireAuth);

function serialize(p, outgoing = 0) {
  const stock = p.stock;
  const available = stock - outgoing;
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    category: p.category,
    cost: Number(p.cost),
    price: Number(p.price),
    stock,
    outgoing,
    available,
    lowStockThreshold: p.low_stock_threshold,
    isLow: stock <= p.low_stock_threshold,
    isAvailableLow: available < 10,
    isCritical: available < 0,
  };
}

async function getPendingOutgoingMap() {
  const { rows } = await pool.query("SELECT products FROM orders WHERE status = 'pending'");
  const map = {};
  rows.forEach((row) => {
    const lines = row.products || [];
    lines.forEach((line) => {
      const pid = line.productId || line.itemId || line.id;
      const qty = Number(line.qty);
      if (!pid || !Number.isFinite(qty) || qty <= 0) return;
      map[pid] = (map[pid] || 0) + qty;
    });
  });
  return map;
}

function buildEditDetails(existing, changes) {
  const labels = {
    code: "Code",
    name: "Name",
    category: "Category",
    cost: "Cost",
    price: "Price",
    stock: "Stock",
    low_stock_threshold: "Low stock threshold",
  };
  const parts = [];
  for (const key of Object.keys(changes)) {
    if (String(existing[key]) !== String(changes[key])) {
      parts.push(`${labels[key] || key}: ${existing[key]} → ${changes[key]}`);
    }
  }
  return parts.join(", ");
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
    const outgoingMap = await getPendingOutgoingMap();
    const { rows } = await pool.query(query, params);
    res.json(rows.map((p) => serialize(p, outgoingMap[p.id] || 0)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load inventory" });
  }
});

router.get("/next-code", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT code FROM products
       WHERE code ~ '^[0-9]+$'
       ORDER BY code::int DESC
       LIMIT 1`
    );
    const next = rows[0] ? String(Number(rows[0].code) + 1) : "1001";
    res.json({ code: next });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not generate next product code" });
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

// GET /api/inventory/damage-reports/:id -> for printing
router.get("/damage-reports/:id", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT d.*, p.name AS product_name, p.code AS product_code, u.name AS staff_name
     FROM damage_reports d
     JOIN products p ON p.id = d.product_id
     LEFT JOIN users u ON u.id = d.staff_id
     WHERE d.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Damage report not found" });
  const d = rows[0];
  res.json({
    id: d.id,
    productName: d.product_name,
    productCode: d.product_code,
    quantity: d.quantity,
    issue: d.issue,
    staffName: d.staff_name,
    createdAt: d.created_at,
  });
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
    const { rows: dupRows } = await pool.query(
      "SELECT id FROM products WHERE LOWER(name) = LOWER($1)",
      [name.trim()]
    );
    if (dupRows.length > 0) {
      return res.status(409).json({ error: `A product named "${name.trim()}" already exists` });
    }

    const { rows } = await pool.query(
      `INSERT INTO products (code, name, category, cost, price, stock, low_stock_threshold)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [code, name, category, cost || 0, price || 0, stock || 0, lowStockThreshold || 5]
    );

    await logActivity({
      actorId: req.user.id,
      actorName: req.user.name,
      action: "Added new product",
      entityType: "product",
      entityLabel: rows[0].name,
      details: `Code ${rows[0].code} · ${rows[0].category} · Initial stock ${rows[0].stock}`,
    });

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

  const changes = { code, name, category, cost, price, stock, low_stock_threshold: lowStockThreshold };
  const details = buildEditDetails(existing, changes);

  try {
    const { rows } = await pool.query(
      `UPDATE products SET code=$1, name=$2, category=$3, cost=$4, price=$5, stock=$6, low_stock_threshold=$7
       WHERE id=$8 RETURNING *`,
      [code, name, category, cost, price, stock, lowStockThreshold, req.params.id]
    );

    if (details) {
      await logActivity({
        actorId: req.user.id,
        actorName: req.user.name,
        action: "Edited product",
        entityType: "product",
        entityLabel: rows[0].name,
        details,
      });
    }

    res.json(serialize(rows[0]));
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "A product with that code already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not update product" });
  }
});

// POST /api/inventory/add-stock-batch
// Accepts one or more { productId, quantity } lines (e.g. a delivery with
// multiple products) and records a single printable Goods Receipt for the
// whole batch.
router.post("/add-stock-batch", requireRole("admin", "inventory_staff"), async (req, res) => {
  const { lines } = req.body;
  if (!Array.isArray(lines) || lines.length === 0) {
    return res.status(400).json({ error: "At least one product line is required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const receiptLines = [];
    let totalQty = 0;

    for (const line of lines) {
      const productId = Number(line.productId);
      const qty = Number(line.quantity);
      if (!productId || !qty || qty < 1) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Each line needs a product and a positive quantity" });
      }

      const { rows: existing } = await client.query(
        "SELECT * FROM products WHERE id = $1 FOR UPDATE",
        [productId]
      );
      const product = existing[0];
      if (!product) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: `Product ${productId} not found` });
      }

      await client.query("UPDATE products SET stock = stock + $1 WHERE id = $2", [qty, productId]);
      receiptLines.push({ productId, code: product.code, name: product.name, qty });
      totalQty += qty;
    }

    const { rows: receiptRows } = await client.query(
      `INSERT INTO goods_receipts (products, total_qty, staff_id) VALUES ($1, $2, $3) RETURNING *`,
      [JSON.stringify(receiptLines), totalQty, req.user.id]
    );

    await client.query("COMMIT");

    const receipt = receiptRows[0];
    await logActivity({
      actorId: req.user.id,
      actorName: req.user.name,
      action: "Added stock (Goods Receipt)",
      entityType: "product",
      entityLabel: receiptLines.map((l) => l.name).join(", "),
      details: `${totalQty} unit(s) received across ${receiptLines.length} product(s)`,
      reportType: "goods_receipt",
      reportRefId: receipt.id,
    });

    const outgoingMap = await getPendingOutgoingMap();
    const { rows: refreshedProducts } = await pool.query(
      "SELECT * FROM products WHERE id = ANY($1::int[])",
      [receiptLines.map((l) => l.productId)]
    );

    res.status(201).json({
      receiptId: receipt.id,
      products: refreshedProducts.map((p) => serialize(p, outgoingMap[p.id] || 0)),
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Could not add stock" });
  } finally {
    client.release();
  }
});

// POST /api/inventory/:id/report-damage
router.post("/:id/report-damage", requireRole("admin", "inventory_staff"), async (req, res) => {
  const qty = Number(req.body.quantity);
  const issue = (req.body.issue || "").trim();
  if (!qty || qty < 1) {
    return res.status(400).json({ error: "A positive quantity is required" });
  }
  if (!issue) {
    return res.status(400).json({ error: "Please describe the issue" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: existing } = await client.query("SELECT * FROM products WHERE id = $1 FOR UPDATE", [
      req.params.id,
    ]);
    const product = existing[0];
    if (!product) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Product not found" });
    }
    if (product.stock < qty) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `Only ${product.stock} in stock` });
    }

    await client.query("UPDATE products SET stock = stock - $1 WHERE id = $2", [qty, product.id]);
    const { rows: damageRows } = await client.query(
      `INSERT INTO damage_reports (product_id, quantity, issue, staff_id) VALUES ($1,$2,$3,$4) RETURNING *`,
      [product.id, qty, issue, req.user.id]
    );

    await client.query("COMMIT");

    const damage = damageRows[0];
    await logActivity({
      actorId: req.user.id,
      actorName: req.user.name,
      action: "Reported damaged stock",
      entityType: "product",
      entityLabel: product.name,
      details: `${qty} unit(s) marked damaged — ${issue}`,
      reportType: "damage_report",
      reportRefId: damage.id,
    });

    const outgoingMap = await getPendingOutgoingMap();
    const { rows: refreshed } = await pool.query("SELECT * FROM products WHERE id = $1", [product.id]);
    res.status(201).json(serialize(refreshed[0], outgoingMap[refreshed[0].id] || 0));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Could not report damaged stock" });
  } finally {
    client.release();
  }
});

router.delete("/:id", requireRole("admin", "inventory_staff"), async (req, res) => {
  const { rows: existing } = await pool.query("SELECT * FROM products WHERE id = $1", [req.params.id]);
  if (!existing[0]) return res.status(404).json({ error: "Product not found" });

  try {
    const result = await pool.query("DELETE FROM products WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Product not found" });

    await logActivity({
      actorId: req.user.id,
      actorName: req.user.name,
      action: "Removed product",
      entityType: "product",
      entityLabel: existing[0].name,
      details: `Code ${existing[0].code}`,
    });

    res.json({ success: true });
  } catch (err) {
    if (err.code === "23503") {
      return res.status(409).json({
        error:
          "This product has sales, returns, or damage history and can't be deleted. Consider keeping it with 0 stock instead.",
      });
    }
    console.error(err);
    res.status(500).json({ error: "Could not delete product" });
  }
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