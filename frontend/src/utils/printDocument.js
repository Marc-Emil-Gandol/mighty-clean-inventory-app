export const PRINT_STYLES = `
  * { box-sizing: border-box; }
  body {
    font-family: Inter, system-ui, sans-serif;
    color: #1c2333;
    margin: 0;
    padding: 32px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .doc-header {
    text-align: center;
    margin-bottom: 28px;
  }
  .doc-brand {
    display: flex;
    justify-content: center;
    align-items: baseline;
    gap: 6px;
    line-height: 1;
    margin-bottom: 10px;
  }
  .logo-mighty {
    font-weight: 800;
    font-size: 26px;
    color: #2f6fed;
    letter-spacing: 0.5px;
  }
  .logo-clean {
    font-weight: 800;
    font-size: 26px;
    letter-spacing: 0.5px;
    color: #16a34a;
  }
  .doc-header h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
  }
  .doc-subtitle {
    margin: 6px 0 0;
    color: #8a94a6;
    font-size: 13px;
  }
  .doc-meta { margin-bottom: 20px; font-size: 14px; line-height: 1.7; }
  .doc-meta strong { display: inline-block; min-width: 120px; }
  p { font-size: 14px; line-height: 1.6; }
  .muted { color: #8a94a6; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 14px;
  }
  th, td {
    text-align: left;
    padding: 10px 12px;
    border-bottom: 1px solid #e7eaf3;
  }
  th {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: #8a94a6;
  }
  .doc-total {
    text-align: right;
    font-weight: 700;
    font-size: 15px;
    margin-top: 8px;
  }
  .doc-reason {
    margin-top: 28px;
    padding-top: 16px;
    border-top: 1px solid #e7eaf3;
  }
  .doc-reason strong { display: block; margin-bottom: 6px; }
  .doc-reason p { margin: 0; }
  .signature-block {
    margin-top: 48px;
    width: 240px;
  }
  .signature-space { height: 36px; }
  .signature-underline {
    border-top: 1px solid #1c2333;
    margin-bottom: 6px;
  }
  .signature-name { font-weight: 600; font-size: 14px; }
  .signature-label { color: #8a94a6; font-size: 12px; }
`;

/** Print only the given HTML in a new window — never the full app page. */
export function printHtml(title, html) {
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) {
    alert("Please allow pop-ups to print this document.");
    return;
  }
  win.document.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
      `<style>${PRINT_STYLES}</style></head><body>${html}</body></html>`
  );
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
  };
}

/** Print the inner HTML of a DOM node. */
export function printNode(title, node) {
  if (!node) return;
  printHtml(title, node.innerHTML);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
