const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

async function initDb() {
  // ---------- Schema ----------
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin','inventory_staff','sales_staff')),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      cost DOUBLE PRECISION NOT NULL DEFAULT 0,
      price DOUBLE PRECISION NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER NOT NULL DEFAULT 5,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      contact TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('sale','return')),
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL,
      unit_price DOUBLE PRECISION NOT NULL,
      total DOUBLE PRECISION NOT NULL,
      reason TEXT,
      staff_id INTEGER REFERENCES users(id),
      customer_id INTEGER REFERENCES customers(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_id INTEGER REFERENCES customers(id),
      products JSONB NOT NULL DEFAULT '[]',
      total_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
      total_qty INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL CHECK (status IN ('pending','successful','cancelled','returned')) DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS damage_reports (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL,
      issue TEXT NOT NULL,
      staff_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS goods_receipts (
      id SERIAL PRIMARY KEY,
      products JSONB NOT NULL DEFAULT '[]',
      total_qty INTEGER NOT NULL DEFAULT 0,
      staff_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      actor_id INTEGER REFERENCES users(id),
      actor_name TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_label TEXT,
      details TEXT,
      report_type TEXT,
      report_ref_id INTEGER,
      metadata JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // ---------- Seed (only runs once, on an empty database) ----------
  const {
    rows: [{ count: userCount }],
  } = await pool.query("SELECT COUNT(*)::int AS count FROM users");

  if (userCount === 0) {
    const insertUser =
      "INSERT INTO users (name, username, password_hash, role) VALUES ($1, $2, $3, $4)";
    await pool.query(insertUser, ["Admin", "admin", bcrypt.hashSync("admin123", 10), "admin"]);
    await pool.query(insertUser, [
      "Inventory Iris",
      "inventory",
      bcrypt.hashSync("inventory123", 10),
      "inventory_staff",
    ]);
    await pool.query(insertUser, [
      "Sales Sam",
      "sales",
      bcrypt.hashSync("sales123", 10),
      "sales_staff",
    ]);
    console.log("Seeded default users (admin/inventory/sales, see README for passwords)");
  }

  const {
    rows: [{ count: productCount }],
  } = await pool.query("SELECT COUNT(*)::int AS count FROM products");

  if (productCount === 0) {
    const insertProduct = `INSERT INTO products (code, name, category, cost, price, stock, low_stock_threshold)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`;
    await pool.query(insertProduct, ["1001", "Fabcon Blue Bliss", "Fabcon", 185, 200, 12, 5]);
    await pool.query(insertProduct, [
      "1002",
      "Dishwashing Liquid LEMON",
      "Dishwashing",
      147,
      160,
      4,
      5,
    ]);
    await pool.query(insertProduct, [
      "1003",
      "Antibacterial Fabric Spray Gallon",
      "Fabcon",
      558,
      600,
      2,
      5,
    ]);
    await pool.query(insertProduct, [
      "1004",
      "Detergent Powder Premium Petal Bloom",
      "Detergent",
      65,
      80,
      20,
      5,
    ]);
    console.log("Seeded sample products");
  }
}

module.exports = { pool, initDb };