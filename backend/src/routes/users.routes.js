const express = require("express");
const bcrypt = require("bcryptjs");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { logActivity } = require("../utils/activityLog");

const router = express.Router();
router.use(requireAuth);

function serialize(u) {
  return { id: u.id, name: u.name, username: u.username, role: u.role, createdAt: u.created_at };
}

router.get("/", requireRole("admin"), async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM users ORDER BY id ASC");
  res.json(rows.map(serialize));
});

router.post("/", requireRole("admin"), async (req, res) => {
  const { name, username, password, role } = req.body;
  if (!name || !username || !password || !role) {
    return res.status(400).json({ error: "Name, username, password, and role are all required" });
  }
  if (!["admin", "inventory_staff", "sales_staff"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }
  try {
    const { rows } = await pool.query(
      "INSERT INTO users (name, username, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, username, bcrypt.hashSync(password, 10), role]
    );

    await logActivity({
      actorId: req.user.id,
      actorName: req.user.name,
      action: "Added new employee",
      entityType: "employee",
      entityLabel: rows[0].name,
      details: `Username: ${rows[0].username} · Role: ${rows[0].role.replace("_", " ")}`,
    });

    res.status(201).json(serialize(rows[0]));
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "That username is already taken" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not create user" });
  }
});

router.delete("/:id", requireRole("admin"), async (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: "You can't delete your own account" });
  }
  const { rows: existing } = await pool.query("SELECT * FROM users WHERE id = $1", [req.params.id]);
  if (!existing[0]) return res.status(404).json({ error: "User not found" });

  const result = await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
  if (result.rowCount === 0) return res.status(404).json({ error: "User not found" });

  await logActivity({
    actorId: req.user.id,
    actorName: req.user.name,
    action: "Removed employee",
    entityType: "employee",
    entityLabel: existing[0].name,
    details: `Username: ${existing[0].username}`,
  });

  res.json({ success: true });
});

module.exports = router;
