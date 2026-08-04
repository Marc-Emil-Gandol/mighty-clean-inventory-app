const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

function serializeOrder(row, displayNumber) {
  return {
    id: row.id,
    displayNumber,
    customer: row.customer_name,
    customerId: row.customer_id,
    handoverDate: row.handover_date,
    products: row.products || [],
    totalCost: Number(row.total_cost),
    totalQty: row.total_qty,
    status: row.status,
    createdAt: row.created_at,
  };
}

function safeNum(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

/** Pending qty per product id from orders still in "pending" status */
async function getPendingOutgoingMap(client) {
  const { rows } = await client.query(
    "SELECT products FROM orders WHERE status = 'pending'"
  );
  const map = {};
  rows.forEach((row) => {
    const lines = row.products || [];
    lines.forEach((line) => {
      const pid = line.productId || line.itemId || line.id;
      const qty = safeNum(line.qty != null ? line.qty : line.quantity);
      if (!pid || qty <= 0) return;
      map[pid] = (map[pid] || 0) + qty;
    });
  });
  return map;
}

async function buildDisplayNumberMap(client) {
  const { rows } = await client.query(
    "SELECT id FROM orders ORDER BY created_at ASC, id ASC"
  );
  const map = {};
  rows.forEach((row, i) => {
    map[row.id] = 1001 + i;
  });
  return map;
}

// GET /api/orders
router.get("/", async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const [ordersResult, numMap] = await Promise.all([
        client.query("SELECT * FROM orders ORDER BY created_at DESC"),
        buildDisplayNumberMap(client),
      ]);
      res.json(
        ordersResult.rows.map((row) => serializeOrder(row, numMap[row.id] || row.id))
      );
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load orders" });
  }
});

// GET /api/orders/outgoing — pending outgoing per product (for inventory)
router.get("/outgoing", async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const map = await getPendingOutgoingMap(client);
      res.json(map);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load outgoing quantities" });
  }
});

// POST /api/orders
router.post("/", requireRole("admin", "sales_staff", "inventory_staff"), async (req, res) => {
  const { customer, handoverDate, products, customerId } = req.body;

  if (!customer || !String(customer).trim()) {
    return res.status(400).json({ error: "Customer name is required" });
  }
  if (!handoverDate) {
    return res.status(400).json({ error: "Handover date is required" });
  }
  if (!Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ error: "At least one product line is required" });
  }

  const normalized = [];
  let totalCost = 0;
  let totalQty = 0;

  for (const line of products) {
    const productId = line.productId || line.itemId || line.id;
    const qty = safeNum(line.qty);
    if (!productId || qty < 1) {
      return res.status(400).json({ error: "Each line needs a product and valid quantity" });
    }
    const cost = safeNum(line.cost);
    const name = line.name || "";
    normalized.push({ productId: Number(productId), name, qty, cost });
    totalCost += cost * qty;
    totalQty += qty;
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO orders (customer_name, customer_id, handover_date, products, total_cost, total_qty, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *`,
      [
        String(customer).trim(),
        customerId || null,
        handoverDate,
        JSON.stringify(normalized),
        totalCost,
        totalQty,
      ]
    );
    const numMap = await buildDisplayNumberMap(pool);
    res.status(201).json(serializeOrder(rows[0], numMap[rows[0].id]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create order" });
  }
});

// PATCH /api/orders/:id/complete
router.patch("/:id/complete", requireRole("admin", "sales_staff", "inventory_staff"), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: orderRows } = await client.query("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [
      req.params.id,
    ]);
    const order = orderRows[0];
    if (!order) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Order not found" });
    }
    if (order.status !== "pending") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Only pending orders can be completed" });
    }

    const lines = order.products || [];
    for (const line of lines) {
      const productId = line.productId || line.itemId || line.id;
      const qty = safeNum(line.qty);
      if (!productId || qty <= 0) continue;

      const { rows: productRows } = await client.query(
        "SELECT * FROM products WHERE id = $1 FOR UPDATE",
        [productId]
      );
      const product = productRows[0];
      if (!product) continue;

      await client.query("UPDATE products SET stock = stock - $1 WHERE id = $2", [qty, productId]);
    }

    const { rows: updated } = await client.query(
      "UPDATE orders SET status = 'successful' WHERE id = $1 RETURNING *",
      [req.params.id]
    );

    await client.query("COMMIT");
    const numMap = await buildDisplayNumberMap(pool);
    res.json(serializeOrder(updated[0], numMap[updated[0].id]));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Could not complete order" });
  } finally {
    client.release();
  }
});

// PATCH /api/orders/:id/cancel
router.patch("/:id/cancel", requireRole("admin", "sales_staff", "inventory_staff"), async (req, res) => {
  try {
    const { rows: existing } = await pool.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
    if (!existing[0]) return res.status(404).json({ error: "Order not found" });
    if (existing[0].status !== "pending") {
      return res.status(400).json({ error: "Only pending orders can be cancelled" });
    }

    const { rows: updated } = await pool.query(
      "UPDATE orders SET status = 'cancelled' WHERE id = $1 RETURNING *",
      [req.params.id]
    );
    const numMap = await buildDisplayNumberMap(pool);
    res.json(serializeOrder(updated[0], numMap[updated[0].id]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not cancel order" });
  }
});

// PATCH /api/orders/:id/return — restock items from a successful order
router.patch("/:id/return", requireRole("admin", "sales_staff", "inventory_staff"), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: orderRows } = await client.query("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [
      req.params.id,
    ]);
    const order = orderRows[0];
    if (!order) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Order not found" });
    }
    if (order.status !== "successful") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Only successful orders can be returned" });
    }

    const lines = order.products || [];
    for (const line of lines) {
      const productId = line.productId || line.itemId || line.id;
      const qty = safeNum(line.qty);
      if (!productId || qty <= 0) continue;

      await client.query("UPDATE products SET stock = stock + $1 WHERE id = $2", [qty, productId]);
    }

    const { rows: updated } = await client.query(
      "UPDATE orders SET status = 'returned' WHERE id = $1 RETURNING *",
      [req.params.id]
    );

    await client.query("COMMIT");
    const numMap = await buildDisplayNumberMap(pool);
    res.json(serializeOrder(updated[0], numMap[updated[0].id]));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Could not process return" });
  } finally {
    client.release();
  }
});

// DELETE /api/orders/:id
router.delete("/:id", requireRole("admin", "sales_staff", "inventory_staff"), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: orderRows } = await client.query("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [
      req.params.id,
    ]);
    const order = orderRows[0];
    if (!order) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Order not found" });
    }

    // If deleting a successful order, restore stock first
    if (order.status === "successful") {
      const lines = order.products || [];
      for (const line of lines) {
        const productId = line.productId || line.itemId || line.id;
        const qty = safeNum(line.qty);
        if (!productId || qty <= 0) continue;
        await client.query("UPDATE products SET stock = stock + $1 WHERE id = $2", [qty, productId]);
      }
    }

    await client.query("DELETE FROM orders WHERE id = $1", [req.params.id]);
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Could not delete order" });
  } finally {
    client.release();
  }
});

module.exports = router;
