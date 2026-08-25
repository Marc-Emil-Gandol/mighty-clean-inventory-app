const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);
router.use(requireRole("admin"));

function serialize(row) {
  return {
    id: row.id,
    action: row.action,
    entityType: row.entity_type,
    entityLabel: row.entity_label,
    details: row.details,
    actorName: row.actor_name,
    reportType: row.report_type,
    reportRefId: row.report_ref_id,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 500"
    );
    res.json(rows.map(serialize));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load activity log" });
  }
});

module.exports = router;