import { useEffect, useRef, useState } from "react";
import { ScanLine } from "lucide-react";
import { api } from "../api";

export default function Sales() {
  const [manualCode, setManualCode] = useState("");
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sales, setSales] = useState([]);

  const inputRef = useRef(null);

  function loadSales() {
    api.getSales()
      .then(setSales)
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    loadSales();

    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, []);

  async function lookup(rawValue) {
    setError("");
    setMessage("");

    let code = String(rawValue).trim();

    if (!code) return;

    // Handle QR codes that contain JSON
    try {
      const parsed = JSON.parse(code);

      if (parsed.code) {
        code = parsed.code;
      }
    } catch {
      // Plain barcode
    }

    setManualCode(code);

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
    lookup(inputRef.current.value);
  }

  function handleScannerKeyDown(e) {
    if (e.key !== "Enter") return;

    e.preventDefault();

    lookup(inputRef.current.value);
  }

  async function handleRecordSale() {
    if (!product) return;

    setError("");

    try {
      await api.recordSale({
        code: product.code,
        quantity: Number(quantity),
      });

      setMessage(`Sale recorded: ${quantity} × ${product.name}`);

      setProduct(null);
      setManualCode("");
      setQuantity(1);

      loadSales();

      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Sales</h1>
        <p className="page-subtitle">
          Scan a QR code using the T1902L USB scanner or enter the product code manually.
        </p>
      </div>

      <div className="panel-grid">

        <div className="card">
          <h2 className="card-title">Scan Item</h2>

          <form onSubmit={handleManualLookup} className="manual-lookup">
            <input
              ref={inputRef}
              placeholder="Ready to scan..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={handleScannerKeyDown}
              autoFocus
            />

            <button type="submit" className="btn btn-secondary">
              <ScanLine size={16} />
              Look Up
            </button>
          </form>

          <p className="muted" style={{ marginTop: 12 }}>
            Waiting for scanner...
          </p>
        </div>

        <div className="card">
          <h2 className="card-title">Record Sale</h2>

          {error && <div className="form-error">{error}</div>}
          {message && <div className="form-success">{message}</div>}

          {product ? (
            <div className="sale-preview">

              <div className="sale-preview-name">
                {product.name}
              </div>

              <div className="muted">
                Code {product.code} · {product.category}
              </div>

              <div className="sale-preview-price">
                ₱{Number(product.price).toFixed(2)} / unit
              </div>

              <div className="muted">
                In stock: {product.stock}
              </div>

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

              <div className="sale-total">
                Total: ₱
                {(Number(quantity) * Number(product.price)).toLocaleString()}
              </div>

              <button
                className="btn btn-primary btn-block"
                onClick={handleRecordSale}
              >
                Record Sale
              </button>

            </div>
          ) : (
            <p className="muted">
              Scan a QR code to begin.
            </p>
          )}

        </div>

      </div>

      <div className="card">
        <h2 className="card-title">Recent Sales</h2>

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
                <td>
                  {s.product_name}{" "}
                  <span className="muted">
                    ({s.product_code})
                  </span>
                </td>

                <td>{s.quantity}</td>

                <td>₱{Number(s.total).toLocaleString()}</td>

                <td>{s.staff_name || "—"}</td>

                <td className="muted">
                  {new Date(s.created_at).toLocaleString()}
                </td>
              </tr>
            ))}

            {sales.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="muted"
                  style={{ textAlign: "center" }}
                >
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
