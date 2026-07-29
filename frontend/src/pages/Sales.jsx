import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { ScanLine, Camera, CameraOff } from "lucide-react";
import { api } from "../api";

const SCANNER_ELEMENT_ID = "qr-scanner-region";

export default function Sales() {
  const [manualCode, setManualCode] = useState("");
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sales, setSales] = useState([]);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef(null);

  function loadSales() {
    api.getSales().then(setSales).catch((e) => setError(e.message));
  }

  useEffect(() => {
    loadSales();
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lookup(code) {
    setError("");
    setMessage("");
    try {
      const p = await api.lookupCode(code);
      setProduct(p);
      setQuantity(1);
    } catch (err) {
      setProduct(null);
      setError(err.message);
    }
  }

  function handleManualLookup(e) {
    e.preventDefault();
    if (manualCode.trim()) lookup(manualCode.trim());
  }

  async function startScanner() {
    setError("");
    setScanning(true);
    try {
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 220 },
        (decodedText) => {
          let code = decodedText;
          try {
            const parsed = JSON.parse(decodedText);
            if (parsed?.code) code = parsed.code;
          } catch {
            /* plain text QR, use as-is */
          }
          lookup(code);
          stopScanner();
        },
        () => {} // ignore per-frame scan failures
      );
    } catch (err) {
      setError("Couldn't access the camera. You can still type the code in manually below.");
      setScanning(false);
    }
  }

  async function stopScanner() {
    const scanner = scannerRef.current;
    if (scanner) {
      try {
        await scanner.stop();
        scanner.clear();
      } catch {
        /* already stopped */
      }
      scannerRef.current = null;
    }
    setScanning(false);
  }

  async function handleRecordSale() {
    if (!product) return;
    setError("");
    try {
      await api.recordSale({ code: product.code, quantity: Number(quantity) });
      setMessage(`Sale recorded: ${quantity} × ${product.name}`);
      setProduct(null);
      setManualCode("");
      loadSales();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Sales</h1>
        <p className="page-subtitle">Scan an item's QR code, or enter its product code, to record a sale.</p>
      </div>

      <div className="panel-grid">
        <div className="card">
          <h2 className="card-title">Scan item</h2>

          <div id={SCANNER_ELEMENT_ID} className={scanning ? "scanner-box active" : "scanner-box"} />

          <button
            className={`btn ${scanning ? "btn-secondary" : "btn-primary"} btn-block`}
            onClick={scanning ? stopScanner : startScanner}
            style={{ marginTop: 12 }}
          >
            {scanning ? <><CameraOff size={16} /> Stop camera</> : <><Camera size={16} /> Start camera scan</>}
          </button>

          <div className="divider">or enter code manually</div>

          <form onSubmit={handleManualLookup} className="manual-lookup">
            <input
              placeholder="Product code, e.g. 1001"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary">
              <ScanLine size={16} /> Look up
            </button>
          </form>
        </div>

        <div className="card">
          <h2 className="card-title">Record sale</h2>
          {error && <div className="form-error">{error}</div>}
          {message && <div className="form-success">{message}</div>}

          {product ? (
            <div className="sale-preview">
              <div className="sale-preview-name">{product.name}</div>
              <div className="muted">Code {product.code} · {product.category}</div>
              <div className="sale-preview-price">₱{Number(product.price).toFixed(2)} / unit</div>
              <div className="muted">In stock: {product.stock}</div>

              <label className="qty-label">
                Quantity
                <input
                  type="number"
                  min={1}
                  max={product.stock}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </label>

              <div className="sale-total">Total: ₱{(Number(quantity || 0) * product.price).toLocaleString()}</div>

              <button className="btn btn-primary btn-block" onClick={handleRecordSale}>
                Record sale
              </button>
            </div>
          ) : (
            <p className="muted">Scan or look up a product to get started.</p>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Recent sales</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Qty</th>
              <th>Total</th>
              <th>Staff</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td>{s.product_name} <span className="muted">({s.product_code})</span></td>
                <td>{s.quantity}</td>
                <td>₱{s.total.toLocaleString()}</td>
                <td>{s.staff_name || "—"}</td>
                <td className="muted">{new Date(s.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr>
                <td colSpan={5} className="muted" style={{ textAlign: "center" }}>
                  No sales recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
