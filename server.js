const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "TamMobile@2026";
const SESSION_SECRET = process.env.SESSION_SECRET || "CHANGE_THIS_SECRET_BEFORE_DEPLOYING";

const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "tam-mobile.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  price INTEGER NOT NULL CHECK(price >= 0),
  old_price INTEGER DEFAULT NULL,
  image TEXT DEFAULT '',
  description TEXT DEFAULT '',
  stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
  featured INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_code TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  note TEXT DEFAULT '',
  payment_method TEXT NOT NULL DEFAULT 'cod',
  status TEXT NOT NULL DEFAULT 'pending',
  total INTEGER NOT NULL,
  items_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);
`);

const productCount = db.prepare("SELECT COUNT(*) AS n FROM products").get().n;
if (productCount === 0) {
  const seed = [
    ["iPhone 16 Pro Max 256GB","iPhone",32990000,34990000,"https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=900&q=85","Màn hình Super Retina XDR, camera chuyên nghiệp, thiết kế titan.",12,1],
    ["iPhone 15 128GB","iPhone",16990000,19990000,"https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=900&q=85","Điện thoại Apple hiệu năng mạnh, camera sắc nét.",18,1],
    ["Samsung Galaxy S25 Ultra","Samsung",29990000,33990000,"https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=900&q=85","Màn hình lớn, camera zoom cao cấp, hiệu năng mạnh mẽ.",10,1],
    ["Samsung Galaxy A56 5G","Samsung",10990000,11990000,"https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=900&q=85","Màn hình sống động, pin bền, hỗ trợ 5G.",20,0],
    ["OPPO Reno13 5G","OPPO",14990000,15990000,"https://images.unsplash.com/photo-1598327299173-4f5d1f8c5b4b?auto=format&fit=crop&w=900&q=85","Thiết kế thanh lịch, camera chân dung nổi bật.",14,1],
    ["OPPO A5 Pro","OPPO",6990000,7490000,"https://images.unsplash.com/photo-1598327299173-4f5d1f8c5b4b?auto=format&fit=crop&w=900&q=85","Điện thoại thực dụng cho nhu cầu hằng ngày.",22,0],
    ["Xiaomi 15 5G","Xiaomi",22990000,24990000,"https://images.unsplash.com/photo-1598327299173-4f5d1f8c5b4b?auto=format&fit=crop&w=900&q=85","Hiệu năng cao, màn hình đẹp, sạc nhanh.",9,1],
    ["Redmi Note 14 Pro","Xiaomi",7990000,8990000,"https://images.unsplash.com/photo-1598327299173-4f5d1f8c5b4b?auto=format&fit=crop&w=900&q=85","Lựa chọn cân bằng giữa hiệu năng và chi phí.",16,0]
  ];
  const insert = db.prepare(`INSERT INTO products(name,brand,price,old_price,image,description,stock,featured)
    VALUES(?,?,?,?,?,?,?,?)`);
  const tx = db.transaction(rows => rows.forEach(row => insert.run(...row)));
  tx(seed);
}
const existingAdmin = db.prepare("SELECT id FROM admins WHERE username = ?").get(ADMIN_USER);
if (!existingAdmin) {
  db.prepare("INSERT INTO admins(username,password_hash) VALUES(?,?)")
    .run(ADMIN_USER, bcrypt.hashSync(ADMIN_PASSWORD, 12));
}

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  name: "tam_mobile_sid",
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 1000 * 60 * 60 * 4 }
}));
app.use(express.static(path.join(__dirname, "public")));

const cleanText = (v, max = 500) => String(v ?? "").trim().slice(0, max);
const moneyInt = v => Number.isSafeInteger(Number(v)) && Number(v) >= 0 ? Number(v) : NaN;
function requireAdmin(req, res, next) {
  if (!req.session.adminId) return res.status(401).json({ error: "Vui lòng đăng nhập quản trị." });
  next();
}
function validPhone(phone) { return /^[0-9+().\-\s]{9,16}$/.test(phone); }

app.get("/api/products", (req, res) => {
  const q = cleanText(req.query.q, 100);
  const brand = cleanText(req.query.brand, 40);
  const min = req.query.min === undefined || req.query.min === "" ? null : moneyInt(req.query.min);
  const max = req.query.max === undefined || req.query.max === "" ? null : moneyInt(req.query.max);
  const sort = cleanText(req.query.sort, 20);
  if ((min !== null && Number.isNaN(min)) || (max !== null && Number.isNaN(max))) {
    return res.status(400).json({ error: "Khoảng giá không hợp lệ." });
  }
  let sql = "SELECT * FROM products WHERE 1=1";
  const args = [];
  if (q) { sql += " AND (name LIKE ? OR brand LIKE ? OR description LIKE ?)"; args.push(`%${q}%`,`%${q}%`,`%${q}%`); }
  if (brand && brand !== "all") { sql += " AND brand = ?"; args.push(brand); }
  if (min !== null) { sql += " AND price >= ?"; args.push(min); }
  if (max !== null) { sql += " AND price <= ?"; args.push(max); }
  if (sort === "price-asc") sql += " ORDER BY price ASC";
  else if (sort === "price-desc") sql += " ORDER BY price DESC";
  else if (sort === "name") sql += " ORDER BY name ASC";
  else sql += " ORDER BY featured DESC, id DESC";
  res.json(db.prepare(sql).all(...args));
});
app.get("/api/products/:id", (req, res) => {
  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(Number(req.params.id));
  if (!product) return res.status(404).json({ error: "Không tìm thấy sản phẩm." });
  res.json(product);
});

app.post("/api/orders", (req, res) => {
  const name = cleanText(req.body.name, 100);
  const phone = cleanText(req.body.phone, 20);
  const address = cleanText(req.body.address, 300);
  const note = cleanText(req.body.note, 500);
  const payment = req.body.payment === "cod" ? "cod" : null;
  const items = req.body.items;
  if (name.length < 2 || !validPhone(phone) || address.length < 8 || !payment) {
    return res.status(400).json({ error: "Vui lòng kiểm tra họ tên, số điện thoại, địa chỉ và phương thức thanh toán." });
  }
  if (!Array.isArray(items) || items.length < 1 || items.length > 30) {
    return res.status(400).json({ error: "Giỏ hàng không hợp lệ." });
  }
  const normalized = [];
  const seen = new Set();
  for (const item of items) {
    const id = Number(item.id), qty = Number(item.qty);
    if (!Number.isInteger(id) || !Number.isInteger(qty) || qty < 1 || qty > 20 || seen.has(id)) {
      return res.status(400).json({ error: "Sản phẩm hoặc số lượng không hợp lệ." });
    }
    seen.add(id);
    const product = db.prepare("SELECT id,name,brand,price,stock,image FROM products WHERE id = ?").get(id);
    if (!product) return res.status(400).json({ error: "Có sản phẩm không còn tồn tại." });
    if (product.stock < qty) return res.status(400).json({ error: `${product.name} chỉ còn ${product.stock} sản phẩm.` });
    normalized.push({ ...product, qty, lineTotal: product.price * qty });
  }
  const total = normalized.reduce((sum, item) => sum + item.lineTotal, 0);
  if (!Number.isSafeInteger(total) || total <= 0) return res.status(400).json({ error: "Tổng đơn hàng không hợp lệ." });
  const orderCode = "TM" + Date.now().toString().slice(-8) + crypto.randomBytes(2).toString("hex").toUpperCase();
  const createOrder = db.transaction(() => {
    for (const item of normalized) {
      const result = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?")
        .run(item.qty, item.id, item.qty);
      if (result.changes !== 1) throw new Error(`Số lượng tồn kho của ${item.name} vừa thay đổi. Vui lòng thử lại.`);
    }
    db.prepare(`INSERT INTO orders(order_code,customer_name,phone,address,note,payment_method,status,total,items_json)
      VALUES(?,?,?,?,?,'cod','pending',?,?)`)
      .run(orderCode, name, phone, address, note, total, JSON.stringify(normalized));
  });
  try {
    createOrder();
    res.status(201).json({ message: "Đặt hàng thành công!", orderCode, total });
  } catch (e) {
    res.status(400).json({ error: e.message || "Không thể tạo đơn hàng." });
  }
});

app.post("/api/admin/login", (req, res) => {
  const username = cleanText(req.body.username, 100);
  const password = String(req.body.password ?? "");
  const admin = db.prepare("SELECT * FROM admins WHERE username = ?").get(username);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ error: "Tên đăng nhập hoặc mật khẩu không đúng." });
  }
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: "Không thể tạo phiên đăng nhập." });
    req.session.adminId = admin.id;
    req.session.username = admin.username;
    res.json({ message: "Đăng nhập thành công.", username: admin.username });
  });
});
app.post("/api/admin/logout", requireAdmin, (req, res) => {
  req.session.destroy(() => res.json({ message: "Đã đăng xuất." }));
});
app.get("/api/admin/me", requireAdmin, (req, res) => res.json({ username: req.session.username }));
app.get("/api/admin/orders", requireAdmin, (req, res) => {
  const rows = db.prepare("SELECT * FROM orders ORDER BY id DESC").all();
  res.json(rows.map(o => ({ ...o, items: JSON.parse(o.items_json) })));
});
app.patch("/api/admin/orders/:id", requireAdmin, (req, res) => {
  const status = cleanText(req.body.status, 30);
  const allowed = ["pending","confirmed","shipping","completed","cancelled"];
  if (!allowed.includes(status)) return res.status(400).json({ error: "Trạng thái không hợp lệ." });
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(Number(req.params.id));
  if (!order) return res.status(404).json({ error: "Không tìm thấy đơn hàng." });
  if (order.status === "cancelled" && status !== "cancelled") {
    return res.status(400).json({ error: "Đơn đã hủy không thể mở lại tự động." });
  }
  const update = db.transaction(() => {
    if (status === "cancelled" && order.status !== "cancelled") {
      for (const item of JSON.parse(order.items_json)) {
        db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").run(item.qty, item.id);
      }
    }
    db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, order.id);
  });
  update();
  res.json({ message: "Đã cập nhật trạng thái đơn hàng." });
});
app.post("/api/admin/products", requireAdmin, (req, res) => {
  const p = normalizeProduct(req.body);
  if (p.error) return res.status(400).json({ error: p.error });
  const result = db.prepare(`INSERT INTO products(name,brand,price,old_price,image,description,stock,featured)
    VALUES(@name,@brand,@price,@old_price,@image,@description,@stock,@featured)`).run(p);
  res.status(201).json(db.prepare("SELECT * FROM products WHERE id = ?").get(result.lastInsertRowid));
});
app.put("/api/admin/products/:id", requireAdmin, (req, res) => {
  const p = normalizeProduct(req.body);
  if (p.error) return res.status(400).json({ error: p.error });
  const result = db.prepare(`UPDATE products SET name=@name,brand=@brand,price=@price,old_price=@old_price,
    image=@image,description=@description,stock=@stock,featured=@featured WHERE id=@id`).run({ ...p, id: Number(req.params.id) });
  if (!result.changes) return res.status(404).json({ error: "Không tìm thấy sản phẩm." });
  res.json(db.prepare("SELECT * FROM products WHERE id = ?").get(Number(req.params.id)));
});
app.delete("/api/admin/products/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const used = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE items_json LIKE ?").get(`%"id":${id},%`).n;
  if (used) return res.status(400).json({ error: "Sản phẩm đã xuất hiện trong đơn hàng. Hãy đặt tồn kho về 0 thay vì xóa." });
  const result = db.prepare("DELETE FROM products WHERE id = ?").run(id);
  if (!result.changes) return res.status(404).json({ error: "Không tìm thấy sản phẩm." });
  res.json({ message: "Đã xóa sản phẩm." });
});

function normalizeProduct(body) {
  const name = cleanText(body.name, 150);
  const brand = cleanText(body.brand, 40);
  const price = moneyInt(body.price);
  const oldPrice = body.old_price === "" || body.old_price === null || body.old_price === undefined ? null : moneyInt(body.old_price);
  const stock = moneyInt(body.stock);
  const image = cleanText(body.image, 1000);
  const description = cleanText(body.description, 1000);
  const allowedBrands = ["iPhone","Samsung","OPPO","Xiaomi","Phụ kiện"];
  if (name.length < 2 || !allowedBrands.includes(brand) || Number.isNaN(price) || price < 1 ||
      (oldPrice !== null && Number.isNaN(oldPrice)) || Number.isNaN(stock) || stock > 100000 ||
      (image && !/^https:\/\/\S+$/i.test(image))) {
    return { error: "Thông tin sản phẩm không hợp lệ. Giá/tồn kho phải là số; ảnh phải dùng đường dẫn HTTPS." };
  }
  return { name, brand, price, old_price: oldPrice, image, description, stock, featured: body.featured ? 1 : 0 };
}

app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => {
  console.log(`Tâm Mobile đang chạy tại http://localhost:${PORT}`);
  console.log(`Trang quản trị: http://localhost:${PORT}/admin`);
  console.log(`Tài khoản mặc định: ${ADMIN_USER}`);
  console.log("Đổi mật khẩu và SESSION_SECRET trước khi triển khai công khai.");
});
