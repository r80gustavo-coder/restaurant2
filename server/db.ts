import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function getDb() {
  return open({
    filename: path.join(__dirname, 'database.sqlite'),
    driver: sqlite3.Database
  });
}

export async function initDb() {
  const db = await getDb();
  
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'admin'
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      phone TEXT,
      address TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      description TEXT,
      image TEXT,
      active BOOLEAN DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      description TEXT,
      price REAL,
      image TEXT,
      categoryId INTEGER,
      type TEXT DEFAULT 'fixed',
      active BOOLEAN DEFAULT 1,
      FOREIGN KEY (categoryId) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number INTEGER UNIQUE,
      status TEXT DEFAULT 'livre',
      loginCode TEXT,
      active BOOLEAN DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tableId INTEGER,
      customer_id INTEGER,
      status TEXT DEFAULT 'pending',
      paymentStatus TEXT DEFAULT 'pending',
      payment_method TEXT,
      total REAL,
      type TEXT,
      delivery_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tableId) REFERENCES tables(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderId INTEGER,
      productId INTEGER,
      quantity INTEGER,
      notes TEXT,
      FOREIGN KEY (orderId) REFERENCES orders(id),
      FOREIGN KEY (productId) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      unit TEXT,
      currentStock REAL,
      minStock REAL,
      cost REAL
    );

    CREATE TABLE IF NOT EXISTS product_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productId INTEGER,
      inventoryItemId INTEGER,
      quantity REAL,
      FOREIGN KEY (productId) REFERENCES products(id),
      FOREIGN KEY (inventoryItemId) REFERENCES inventory_items(id)
    );
    
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id TEXT,
      sender_type TEXT,
      content TEXT,
      read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Insert default admin if not exists
  const admin = await db.get('SELECT * FROM users WHERE email = ?', ['admin@admin.com']);
  if (!admin) {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('admin123', 10);
    await db.run('INSERT INTO users (email, password, role) VALUES (?, ?, ?)', ['admin@admin.com', hash, 'admin']);
  }

  return db;
}
