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
  try {
    await initDb();
    console.log('Database initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize database. Please check your MySQL credentials.', err);
  }

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
  app.use((req: any, res, next) => {
    req.io = io;
    next();
  });

  // --- API Routes ---

  // Auth
  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const db = await getDb();
    
    try {
      // Check admin users
      const [users]: any = await db.query('SELECT * FROM users WHERE email = ?', [email]);
      const user = users[0];
      if (user && await bcrypt.compare(password, user.password)) {
        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
        return res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
      }

      // Check customers
      const [customers]: any = await db.query('SELECT * FROM customers WHERE email = ?', [email]);
      const customer = customers[0];
      if (customer) {
        const token = jwt.sign({ id: customer.id, role: 'customer' }, JWT_SECRET, { expiresIn: '1d' });
        return res.json({ token, user: customer });
      }

      res.status(401).json({ error: 'Invalid credentials' });
    } catch (err) {
      res.status(500).json({ error: 'Database error' });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    const { name, email, password, phone, address } = req.body;
    const db = await getDb();
    
    try {
      const [result]: any = await db.execute(
        'INSERT INTO customers (name, email, phone, address) VALUES (?, ?, ?, ?)',
        [name, email, phone, address]
      );
      
      const [customers]: any = await db.query('SELECT * FROM customers WHERE id = ?', [result.insertId]);
      const customer = customers[0];
      const token = jwt.sign({ id: customer.id, role: 'customer' }, JWT_SECRET, { expiresIn: '1d' });
      res.json({ token, user: customer });
    } catch (e) {
      res.status(400).json({ error: 'Email already exists or invalid data' });
    }
  });

  // Tables
  app.get('/api/tables', async (req, res) => {
    try {
      const db = await getDb();
      const [tables] = await db.query('SELECT * FROM tables ORDER BY number');
      res.json(tables);
    } catch (err) {
      res.status(500).json({ error: 'Database error' });
    }
  });

  app.post('/api/tables/login', async (req, res) => {
    const { tableId, code } = req.body;
    try {
      const db = await getDb();
      const [tables]: any = await db.query('SELECT * FROM tables WHERE id = ?', [tableId]);
      const table = tables[0];
      
      if (!table || !table.active) return res.status(404).json({ error: 'Table not found or inactive' });
      if (table.loginCode !== code.toUpperCase()) return res.status(401).json({ error: 'Invalid code' });
      
      res.json(table);
    } catch (err) {
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Products & Categories
  app.get('/api/categories', async (req, res) => {
    try {
      const db = await getDb();
      const [categories] = await db.query('SELECT * FROM categories ORDER BY name');
      res.json(categories);
    } catch (err) {
      res.status(500).json({ error: 'Database error' });
    }
  });

  app.get('/api/products', async (req, res) => {
    try {
      const db = await getDb();
      const [products]: any = await db.query(`
        SELECT p.*, c.name as categoryName 
        FROM products p 
        LEFT JOIN categories c ON p.categoryId = c.id 
        ORDER BY p.name
      `);
      
      // Fetch ingredients for composed products
      for (let p of products) {
        if (p.type === 'composed') {
          const [ingredients] = await db.query(`
            SELECT pi.*, i.name as inventoryName, i.currentStock 
            FROM product_ingredients pi
            JOIN inventory_items i ON pi.inventoryItemId = i.id
            WHERE pi.productId = ?
          `, [p.id]);
          p.ingredients = ingredients;
        } else {
          const [inventory_items]: any = await db.query('SELECT * FROM inventory_items WHERE id = ?', [p.id]);
          p.inventory_item = inventory_items[0] || null;
        }
      }
      
      res.json(products);
    } catch (err) {
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Orders
  app.post('/api/orders', async (req: any, res) => {
    const { tableId, customer_id, items, total, type, delivery_address, payment_method } = req.body;
    const db = await getDb();
    
    try {
      await db.query('START TRANSACTION');
      
      const [orderResult]: any = await db.execute(
        'INSERT INTO orders (tableId, customer_id, total, type, delivery_address, payment_method) VALUES (?, ?, ?, ?, ?, ?)',
        [tableId || null, customer_id || null, total, type, delivery_address, payment_method]
      );
      
      const orderId = orderResult.insertId;
      
      for (const item of items) {
        await db.execute(
          'INSERT INTO order_items (orderId, productId, quantity, notes) VALUES (?, ?, ?, ?)',
          [orderId, item.id, item.quantity, item.notes || '']
        );
      }
      
      if (type === 'table' && tableId) {
        await db.execute('UPDATE tables SET status = ? WHERE id = ?', ['ocupada', tableId]);
      }
      
      await db.query('COMMIT');
      
      const [newOrders]: any = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]);
      const newOrder = newOrders[0];
      
      // Notify via Socket.io
      req.io.to('admin').emit('new-order', newOrder);
      if (tableId) req.io.to('admin').emit('table-updated', { id: tableId, status: 'ocupada' });
      
      res.json(newOrder);
    } catch (e) {
      await db.query('ROLLBACK');
      res.status(500).json({ error: 'Failed to create order' });
    }
  });

  app.get('/api/orders', async (req, res) => {
    try {
      const db = await getDb();
      const [orders] = await db.query('SELECT * FROM orders ORDER BY created_at DESC');
      res.json(orders);
    } catch (err) {
      res.status(500).json({ error: 'Database error' });
    }
  });

  app.patch('/api/orders/:id/status', async (req: any, res) => {
    const { status } = req.body;
    const { id } = req.params;
    
    try {
      const db = await getDb();
      await db.execute('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
      const [orders]: any = await db.query('SELECT * FROM orders WHERE id = ?', [id]);
      const order = orders[0];
      
      req.io.to('admin').emit('order-updated', order);
      if (order.tableId) req.io.to(`table-${order.tableId}`).emit('order-updated', order);
      if (order.customer_id) req.io.to(`customer-${order.customer_id}`).emit('order-updated', order);
      
      res.json(order);
    } catch (err) {
      res.status(500).json({ error: 'Database error' });
    }
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
    console.log(\`Servidor rodando na porta \${PORT}\`);
  });
}

startServer();
