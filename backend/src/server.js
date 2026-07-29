require("dotenv").config();
const express = require("express");
const cors = require("cors");

const { initDb } = require("./db");

const authRoutes = require("./routes/auth.routes");
const inventoryRoutes = require("./routes/inventory.routes");
const salesRoutes = require("./routes/sales.routes");
const returnsRoutes = require("./routes/returns.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const reportsRoutes = require("./routes/reports.routes");
const usersRoutes = require("./routes/users.routes");
const customersRoutes = require("./routes/customers.routes");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/returns", returnsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/customers", customersRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found" }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server" });
});

const PORT = process.env.PORT || 4000;

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Mighty Clean API running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize the database:", err);
    process.exit(1);
  });
