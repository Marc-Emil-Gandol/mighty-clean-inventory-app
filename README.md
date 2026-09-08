# Mighty Clean — Inventory Management App

A web app for managing inventory, orders, sales, returns, customers, and
reports for Mighty Clean. This guide covers how to **use** the app day to
day. (If you need to set up or deploy the app itself, that's a separate,
one-time technical task handled by whoever installed it for you.)

## Logging in

Go to the app's login page and sign in with the username and password given
to you by your admin. Demo accounts (if not yet changed):

- `admin` / `admin123` — full access
- `inventory` / `inventory123` — inventory-focused access
- `sales` / `sales123` — sales-focused access

## Roles, at a glance

| Role | Can do |
|---|---|
| **Admin** | Everything, including managing employee accounts and viewing the Activity Log |
| **Inventory staff** | Manage products/stock, orders, customers, reports |
| **Sales staff** | Record sales, manage orders, customers, reports |

The sidebar only shows the pages your role can use.

## Dashboard

Your homepage after logging in. Shows total products, low-stock items,
current inventory value, today's sales, a sales trend chart (switch between
Daily/Weekly/Monthly/Yearly), low-stock alerts, and your most recent sales.

## Inventory

View every product, its stock, available stock (stock minus what's tied up
in pending orders), and cost.

**Adding a new product**
1. Click **Add Stock / Product** → **Add New Product**.
2. A product code is generated automatically (click **Edit** if you'd
   rather set your own).
3. Fill in name, category (or type a new one), cost, and initial stock,
   then **Add Product**.

**Adding stock (a delivery / Goods Receipt)**
1. Click **Add Stock / Product** → **Add Stock to Existing Product(s)**.
2. If a delivery contains several different products, just click
   **+ Add Product** to add more lines — you can add stock for as many
   products as you need in one go.
3. **Optional scanner:** if you have a T-1902L USB QR scanner, click into
   the "Scan product" field at the top and scan the QR code printed for
   each product. Each scan adds one unit to that product's line
   automatically (scan it multiple times, or edit the quantity by hand).
   You can also just type a product code into that field and press Enter.
4. Click **Add Stock**. This updates the stock counts and automatically
   creates a printable **Goods Receipt**, viewable anytime under
   **Reports → Goods Receipts**.

**Other actions**
- **QR code** — view/download a printable QR code for a product (used by
  the scanner during sales, stock-adds, and orders).
- **Edit** — change a product's name, category, cost, or stock directly.
- **Report Damage** — record damaged/lost stock; this deducts stock and
  creates a printable Damage Report.
- **Delete** — remove a product entirely (only possible if it has no sales
  or damage history yet).

## Orders

Create and manage customer orders that go through a lifecycle:
**pending → successful** (stock is deducted) **or cancelled**, and a
successful order can later be **returned** (stock is restored).

**Creating a new order**
1. Click **New Order** and enter the customer's name.
2. **Optional scanner:** scan a product's QR code (or type its code and
   press Enter) in the "Scan product" field to add it to the order
   automatically — scanning the same product again increases its quantity.
3. Or add products manually with **+ Add Product**, choosing a product and
   quantity for each line.
4. Click **Create Order**.

**Managing an order**
- ✅ **Mark as Successful** — completes the order and deducts stock;
  generates a printable Sales Receipt.
- ✖ **Cancel** — cancels a pending order (no stock change).
- ↩ **Process Return** — restocks a successful order's items; generates a
  printable Return Receipt.
- 🗑 **Delete** — removes the order (restores stock first if it was
  successful).
- 📄 — view/print the order's invoice or receipt at any time.

## Sales (quick point-of-sale)

For a walk-up sale without a full order: scan a product's QR code (or type
its code and press Enter) in **Scan Item**, confirm the quantity, and click
**Record Sale**. This deducts stock immediately and logs the sale.

## Returns

For restocking items outside of an order flow: enter a product code and
quantity, optionally note a reason, and submit. This adds the stock back.

## Customers

Keep a simple directory of customers with a name and contact info. Click
the eye icon on any customer to see their full order history.

## Reports

- **Inventory report** — a snapshot of every product's cost, price, stock,
  available stock, and outgoing (reserved by pending orders) stock.
- **Sales report** — generate for a preset period (Daily/Weekly/Monthly/
  Yearly) or a custom date range; shows every sale with totals.
- **Goods Receipts** — a running history of every stock delivery recorded
  through Inventory → Add Stock. Click the eye icon on any receipt to view
  or print it.

All reports and receipts across the app can be printed using the **Print**
button in their preview.

## Employees (admin only)

Create accounts for new staff (name, username, temporary password, role)
and remove accounts that are no longer needed.

## Activity Log (admin only)

A complete audit trail of everything that happens in the system — who did
what and when — with quick access to the printable document behind any
sale, return, damage report, or goods receipt.

## Using the T-1902L QR scanner

The scanner behaves like a keyboard: point it at a product's printed QR
code, and it "types" the code into whatever text field is focused, then
presses Enter for you. It works in:

- **Sales** — Scan Item field
- **Orders** — the "Scan product" field when creating a new order
- **Inventory** — the "Scan product" field when adding stock

If you don't have the scanner handy, you can always type the product code
by hand into the same field and press Enter.

## Getting help

If something looks wrong (a number doesn't add up, a page won't load), an
admin can check the **Activity Log** to see the full history of changes, or
reach out to whoever manages the technical side of the app.