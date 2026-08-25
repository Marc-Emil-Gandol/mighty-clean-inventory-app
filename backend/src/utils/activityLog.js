const { pool } = require("../db");

async function logActivity({
  actorId,
  actorName,
  action,
  entityType,
  entityLabel,
  details,
  reportType = null,
  reportRefId = null,
  metadata = null,
}) {
  try {
    await pool.query(
      `INSERT INTO activity_log
        (actor_id, actor_name, action, entity_type, entity_label, details, report_type, report_ref_id, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        actorId || null,
        actorName || "Unknown",
        action,
        entityType,
        entityLabel || null,
        details || null,
        reportType,
        reportRefId,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );
  } catch (err) {
    // Never let logging failures break the primary action
    console.error("Failed to write activity log:", err);
  }
}

module.exports = { logActivity };