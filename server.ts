import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initDb, getDb } from './db.js';
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

  // Generic CRUD for tables
  const tables_list = ['users', 'customers', 'categories', 'products', 'tables', 'orders', 'order_items', 'inventory_items', 'product_ingredients', 'chat_messages', 'drivers', 'staff'];
  
  tables_list.forEach(tableName => {
    // GET all or filtered
    app.get(`/api/${tableName}`, async (req, res) => {
      try {
        const db = await getDb();
        let query = `SELECT * FROM ${tableName}`;
        const params: any[] = [];
        
        const filters = Object.keys(req.query).filter(k => k !== 'orderBy' && k !== 'ascending' && k !== 'limit' && k !== 'select');
        if (filters.length > 0) {
          query += ' WHERE ' + filters.map(f => `${f} = ?`).join(' AND ');
          filters.forEach(f => params.push(req.query[f]));
        }
        
        if (req.query.orderBy) {
          query += ` ORDER BY ${req.query.orderBy} ${req.query.ascending === 'false' ? 'DESC' : 'ASC'}`;
        }
        
        if (req.query.limit) {
          query += ` LIMIT ${Number(req.query.limit)}`;
        }
        
        const [rows] = await db.query(query, params);
        res.json(rows);
      } catch (err) {
        console.error(`Error fetching ${tableName}:`, err);
        res.status(500).json({ error: 'Database error' });
      }
    });

    // POST new
    app.post(`/api/${tableName}`, async (req: any, res) => {
      try {
        const db = await getDb();
        const keys = Object.keys(req.body);
        const values = Object.values(req.body);
        
        const query = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
        const [result]: any = await db.execute(query, values as any[]);
        
        const [rows]: any = await db.query(`SELECT * FROM ${tableName} WHERE id = ?`, [result.insertId]);
        const newRow = rows[0];
        
        // Broadcast changes
        req.io.to('admin').emit(`${tableName.replace(/s$/, '')}-created`, newRow);
        
        res.json(newRow);
      } catch (err) {
        console.error(`Error creating ${tableName}:`, err);
        res.status(500).json({ error: 'Database error' });
      }
    });

    // PATCH update
    app.patch(`/api/${tableName}/:id`, async (req: any, res) => {
      try {
        const db = await getDb();
        const { id } = req.params;
        const keys = Object.keys(req.body);
        const values = Object.values(req.body);
        
        const query = `UPDATE ${tableName} SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`;
        await db.execute(query, [...values as any[], id]);
        
        const [rows]: any = await db.query(`SELECT * FROM ${tableName} WHERE id = ?`, [id]);
        const updatedRow = rows[0];
        
        // Broadcast changes
        req.io.to('admin').emit(`${tableName.replace(/s$/, '')}-updated`, updatedRow);
        if (tableName === 'orders') {
          if (updatedRow.tableId) req.io.to(`table-${updatedRow.tableId}`).emit('order-updated', updatedRow);
          if (updatedRow.customer_id) req.io.to(`customer-${updatedRow.customer_id}`).emit('order-updated', updatedRow);
        }
        
        res.json(updatedRow);
      } catch (err) {
        console.error(`Error updating ${tableName}:`, err);
        res.status(500).json({ error: 'Database error' });
      }
    });

    // DELETE
    app.delete(`/api/${tableName}/:id`, async (req: any, res) => {
      try {
        const db = await getDb();
        const { id } = req.params;
        
        await db.execute(`DELETE FROM ${tableName} WHERE id = ?`, [id]);
        
        // Broadcast changes
        req.io.to('admin').emit(`${tableName.replace(/s$/, '')}-deleted`, { id });
        
        res.json({ success: true });
      } catch (err) {
        console.error(`Error deleting ${tableName}:`, err);
        res.status(500).json({ error: 'Database error' });
      }
    });
  });

  // Specific overrides or additional logic
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

  // RPC Mock for exec_sql
  app.post('/api/rpc/exec_sql', async (req, res) => {
    const { sql } = req.body;
    try {
      const db = await getDb();
      await db.query(sql);
      res.json({ success: true });
    } catch (err) {
      console.error('RPC exec_sql error:', err);
      res.status(500).json({ error: 'Failed to execute SQL' });
    }
  });

  // Serve Vite in development or static files in production
  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.join(__dirname, 'dist');
  const hasDist = fs.existsSync(distPath);

  if (!isProd || !hasDist) {
    if (isProd && !hasDist) {
      console.warn('AVISO: NODE_ENV=production mas pasta "dist" não encontrada. Usando Vite middleware...');
    }
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('Servindo arquivos estáticos de: ' + distPath);
    app.use(express.static(distPath));
    
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API route not found' });
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log('Servidor rodando na porta ' + PORT);
  });
}

startServer();
