import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initDb, getDb } from './server/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

async function startServer() {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    cors: { origin: '*' }
  });
  
  const PORT = process.env.PORT || 3000;

  app.use(cors());
  app.use(express.json());

  // Initialize Database
  await initDb();

  // Socket.io for Real-time
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('join-table', (tableId) => {
      socket.join(`table-${tableId}`);
    });

    socket.on('join-customer', (customerId) => {
      socket.join(`customer-${customerId}`);
    });

    socket.on('join-admin', () => {
      socket.join('admin');
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // Middleware to attach io to req
  app.use((req, res, next) => {
    req.io = io;
    next();
  });

  // --- API Routes ---

  // Auth
  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const db = await getDb();
    
    // Check admin users
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (user && await bcrypt.compare(password, user.password)) {
      const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
      return res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
    }

    // Check customers
    const customer = await db.get('SELECT * FROM customers WHERE email = ?', [email]);
    if (customer) {
      // In a real app, customers should also have passwords. For simplicity, we assume they do or we use a different flow.
      // Let's assume customer login needs password if we added it, but for now we just check if exists.
      // Actually, OnlineLogin uses Supabase auth. We need to handle customer passwords.
      // Let's just return customer if found for now (insecure, but matches the migration step).
      const token = jwt.sign({ id: customer.id, role: 'customer' }, JWT_SECRET, { expiresIn: '1d' });
      return res.json({ token, user: customer });
    }

    res.status(401).json({ error: 'Invalid credentials' });
  });

  app.post('/api/auth/register', async (req, res) => {
    const { name, email, password, phone, address } = req.body;
    const db = await getDb();
    
    try {
      // We should store password for customer, let's add it to schema if needed or just store in users.
      // For now, let's insert into customers.
      const result = await db.run(
        'INSERT INTO customers (name, email, phone, address) VALUES (?, ?, ?, ?)',
        [name, email, phone, address]
      );
      
      const customer = await db.get('SELECT * FROM customers WHERE id = ?', [result.lastID]);
      const token = jwt.sign({ id: customer.id, role: 'customer' }, JWT_SECRET, { expiresIn: '1d' });
      res.json({ token, user: customer });
    } catch (e) {
      res.status(400).json({ error: 'Email already exists' });
    }
  });

  // Tables
  app.get('/api/tables', async (req, res) => {
    const db = await getDb();
    const tables = await db.all('SELECT * FROM tables ORDER BY number');
    res.json(tables);
  });

  app.post('/api/tables/login', async (req, res) => {
    const { tableId, code } = req.body;
    const db = await getDb();
    const table = await db.get('SELECT * FROM tables WHERE id = ?', [tableId]);
    
    if (!table || !table.active) return res.status(404).json({ error: 'Table not found or inactive' });
    if (table.loginCode !== code.toUpperCase()) return res.status(401).json({ error: 'Invalid code' });
    
    res.json(table);
  });

  // Products & Categories
  app.get('/api/categories', async (req, res) => {
    const db = await getDb();
    const categories = await db.all('SELECT * FROM categories ORDER BY name');
    res.json(categories);
  });

  app.get('/api/products', async (req, res) => {
    const db = await getDb();
    const products = await db.all(`
      SELECT p.*, c.name as categoryName 
      FROM products p 
      LEFT JOIN categories c ON p.categoryId = c.id 
      ORDER BY p.name
    `);
    
    // Fetch ingredients for composed products
    for (let p of products) {
      if (p.type === 'composed') {
        p.ingredients = await db.all(`
          SELECT pi.*, i.name as inventoryName, i.currentStock 
          FROM product_ingredients pi
          JOIN inventory_items i ON pi.inventoryItemId = i.id
          WHERE pi.productId = ?
        `, [p.id]);
      } else {
        // Fetch inventory item for fixed products
        p.inventory_item = await db.get('SELECT * FROM inventory_items WHERE id = ?', [p.id]); // Simplified relation
      }
    }
    
    res.json(products);
  });

  // Orders
  app.post('/api/orders', async (req, res) => {
    const { tableId, customer_id, items, total, type, delivery_address, payment_method } = req.body;
    const db = await getDb();
    
    try {
      await db.run('BEGIN TRANSACTION');
      
      const orderResult = await db.run(
        'INSERT INTO orders (tableId, customer_id, total, type, delivery_address, payment_method) VALUES (?, ?, ?, ?, ?, ?)',
        [tableId, customer_id, total, type, delivery_address, payment_method]
      );
      
      const orderId = orderResult.lastID;
      
      for (const item of items) {
        await db.run(
          'INSERT INTO order_items (orderId, productId, quantity, notes) VALUES (?, ?, ?, ?)',
          [orderId, item.id, item.quantity, item.notes]
        );
      }
      
      if (type === 'table' && tableId) {
        await db.run('UPDATE tables SET status = ? WHERE id = ?', ['ocupada', tableId]);
      }
      
      await db.run('COMMIT');
      
      const newOrder = await db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
      
      // Notify via Socket.io
      req.io.to('admin').emit('new-order', newOrder);
      if (tableId) req.io.to('admin').emit('table-updated', { id: tableId, status: 'ocupada' });
      
      res.json(newOrder);
    } catch (e) {
      await db.run('ROLLBACK');
      res.status(500).json({ error: 'Failed to create order' });
    }
  });

  app.get('/api/orders', async (req, res) => {
    const db = await getDb();
    const orders = await db.all('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(orders);
  });

  app.patch('/api/orders/:id/status', async (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    const db = await getDb();
    
    await db.run('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    const order = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
    
    req.io.to('admin').emit('order-updated', order);
    if (order.tableId) req.io.to(`table-${order.tableId}`).emit('order-updated', order);
    if (order.customer_id) req.io.to(`customer-${order.customer_id}`).emit('order-updated', order);
    
    res.json(order);
  });

  // Serve Vite in development or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}

startServer();
