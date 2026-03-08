import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

// Create a connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'restaurant_user',
  password: process.env.DB_PASSWORD || 'Gustavor80@',
  database: process.env.DB_NAME || 'restaurant_db',
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export async function getDb() {
  return pool;
}

export async function initDb() {
  const db = await getDb();
  
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) UNIQUE,
      password VARCHAR(255),
      role VARCHAR(50) DEFAULT 'admin'
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      email VARCHAR(255) UNIQUE,
      phone VARCHAR(50),
      address TEXT
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      description TEXT,
      image TEXT,
      active BOOLEAN DEFAULT 1
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      description TEXT,
      price DECIMAL(10,2),
      image TEXT,
      categoryId INT,
      type VARCHAR(50) DEFAULT 'fixed',
      active BOOLEAN DEFAULT 1,
      visible BOOLEAN DEFAULT 1,
      inventoryItemId INT,
      FOREIGN KEY (categoryId) REFERENCES categories(id)
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS tables (
      id INT AUTO_INCREMENT PRIMARY KEY,
      number INT UNIQUE,
      status VARCHAR(50) DEFAULT 'livre',
      loginCode VARCHAR(50),
      active BOOLEAN DEFAULT 1,
      needs_waiter BOOLEAN DEFAULT 0
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS drivers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      email VARCHAR(255) UNIQUE,
      phone VARCHAR(50),
      status VARCHAR(50) DEFAULT 'active',
      vehicle VARCHAR(255)
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS staff (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      role VARCHAR(50),
      email VARCHAR(255) UNIQUE,
      phone VARCHAR(50),
      active BOOLEAN DEFAULT 1
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tableId INT,
      customer_id INT,
      status VARCHAR(50) DEFAULT 'pending',
      paymentStatus VARCHAR(50) DEFAULT 'pending',
      payment_method VARCHAR(50),
      total DECIMAL(10,2),
      type VARCHAR(50),
      delivery_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tableId) REFERENCES tables(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      orderId INT,
      productId INT,
      quantity INT,
      notes TEXT,
      FOREIGN KEY (orderId) REFERENCES orders(id),
      FOREIGN KEY (productId) REFERENCES products(id)
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS inventory_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      unit VARCHAR(50),
      currentStock DECIMAL(10,2),
      minStock DECIMAL(10,2),
      cost DECIMAL(10,2)
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS product_ingredients (
      id INT AUTO_INCREMENT PRIMARY KEY,
      productId INT,
      inventoryItemId INT,
      quantity DECIMAL(10,2),
      FOREIGN KEY (productId) REFERENCES products(id),
      FOREIGN KEY (inventoryItemId) REFERENCES inventory_items(id)
    );
  `);
  
  await db.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sender_id VARCHAR(255),
      sender_type VARCHAR(50),
      content TEXT,
      read_status BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Insert default admin if not exists
  try {
    const [rows]: any = await db.query('SELECT * FROM users WHERE email = ?', ['admin@admin.com']);
    if (rows.length === 0) {
      const hash = await bcrypt.hash('admin123', 10);
      await db.query('INSERT INTO users (email, password, role) VALUES (?, ?, ?)', ['admin@admin.com', hash, 'admin']);
    }
  } catch (err) {
    console.error('Error creating default admin:', err);
  }

  return db;
}
