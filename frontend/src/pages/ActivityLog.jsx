import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { api } from "../api";
import { PrintableReport, hasPrintableActivity } from "../components/PrintableReport";

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);

  function load() {
    api.getActivityLog().then(setLogs).catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function handleViewReport(log) {
    setError("");
    try {
      let data = null;
      if (log.reportType === "damage_report") {
        data = await api.getDamageReport(log.reportRefId);
      } else if (
        log.reportType === "sales_invoice" ||
        log.reportType === "sales_receipt" ||
        log.reportType === "return_receipt"
      ) {
        data = await api.getOrder(log.reportRefId);
      } else if (log.reportType === "inventory_report" || log.reportType === "sales_report") {
        data = log.metadata;
      }
      if (!data) {
        setError("No printable report is available for this record.");
        return;
      }
      // Show the name of the person who originally performed the action,
      // not the admin currently viewing/printing it.
      setPreview({ type: log.reportType, data, generatedBy: log.actorName });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Activity Log</h1>
        <p className="page-subtitle">Every change made across the system, and who made it.</p>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="card table-card">
        <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Action</th>
              <th>Details</th>
              <th>Changed by</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="muted">{new Date(log.createdAt).toLocaleString()}</td>
                <td>
                  <span className="cell-strong">{log.action}</span>
                  {log.entityLabel && <div className="muted">{log.entityLabel}</div>}
                </td>
                <td>{log.details || "—"}</td>
                <td>{log.actorName || "—"}</td>
                <td>
                  {hasPrintableActivity(log) ? (
                    <button
                      className="icon-btn icon-btn-neutral"
                      title="View printable report"
                      onClick={() => handleViewReport(log)}
                    >
                      <Eye size={16} />
                    </button>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="muted" style={{ textAlign: "center" }}>
                  No activity recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {preview && (
        <PrintableReport
          type={preview.type}
          data={preview.data}
          generatedBy={preview.generatedBy}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}