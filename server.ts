import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

const supabase = createClient(supabaseUrl, supabaseAnonKey);



async function startServer() {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });

  app.use(express.json({ limit: '10mb' }));

  // --- CATEGORIES ---
  app.get('/api/categories', async (req, res) => {
    const { data: categories, error } = await supabase.from('categories').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json(categories);
  });
  app.post('/api/categories', async (req, res) => {
    const { name, icon } = req.body;
    const { data, error } = await supabase.from('categories').insert([{ name, icon: icon || 'tag' }]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  app.delete('/api/categories/:id', async (req, res) => {
    const { error } = await supabase.from('categories').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // --- INVENTORY ---
  app.get('/api/inventory', async (req, res) => {
    const { data: items, error } = await supabase.from('inventory_items').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json(items);
  });
  app.post('/api/inventory', async (req, res) => {
    const { name, unit, currentStock, minStock } = req.body;
    const { data, error } = await supabase.from('inventory_items').insert([{ name, unit, currentStock, minStock }]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    io.emit('inventory_updated');
    res.json(data);
  });
  app.put('/api/inventory/:id', async (req, res) => {
    const { name, unit, currentStock, minStock } = req.body;
    const { error } = await supabase.from('inventory_items').update({ name, unit, currentStock, minStock }).eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    io.emit('inventory_updated');
    res.json({ success: true });
  });
  app.post('/api/inventory/:id/add', async (req, res) => {
    const { quantity } = req.body;
    // We need to fetch current stock first, then update
    const { data: item, error: fetchError } = await supabase.from('inventory_items').select('currentStock').eq('id', req.params.id).single();
    if (fetchError) return res.status(500).json({ error: fetchError.message });
    
    const { error: updateError } = await supabase.from('inventory_items').update({ currentStock: item.currentStock + quantity }).eq('id', req.params.id);
    if (updateError) return res.status(500).json({ error: updateError.message });
    
    io.emit('inventory_updated');
    res.json({ success: true });
  });
  app.delete('/api/inventory/:id', async (req, res) => {
    const { error } = await supabase.from('inventory_items').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    io.emit('inventory_updated');
    res.json({ success: true });
  });

  // --- PRODUCTS ---
  app.get('/api/products', async (req, res) => {
    const { data: products, error } = await supabase.from('products').select('*');
    if (error) return res.status(500).json({ error: error.message });

    const productsWithDetails = await Promise.all(products.map(async (p: any) => {
      const { data: ingredients, error: ingError } = await supabase
        .from('product_ingredients')
        .select(`
          id,
          inventoryItemId,
          quantity,
          inventory_items (name, unit)
        `)
        .eq('productId', p.id);
      
      if (ingError) {
        console.error("Error fetching ingredients for product", p.id, ingError);
        return { ...p, ingredients: [] };
      }

      // Flatten the nested inventory_items data
      const formattedIngredients = ingredients.map((ing: any) => ({
        id: ing.id,
        inventoryItemId: ing.inventoryItemId,
        quantity: ing.quantity,
        name: ing.inventory_items?.name,
        unit: ing.inventory_items?.unit
      }));

      return { ...p, ingredients: formattedIngredients };
    }));
    res.json(productsWithDetails);
  });

  app.post('/api/products', async (req, res) => {
    const { name, description, price, categoryId, image, type, inventoryItemId, ingredients } = req.body;
    
    const { data: product, error } = await supabase.from('products').insert([{
      name, description, price, categoryId, image, type, inventoryItemId: type === 'fixed' ? inventoryItemId : null
    }]).select().single();

    if (error) return res.status(500).json({ error: error.message });
    const productId = product.id;

    if (type === 'composed' && ingredients && ingredients.length > 0) {
      const ingredientsToInsert = ingredients.map((ing: any) => ({
        productId,
        inventoryItemId: ing.inventoryItemId,
        quantity: ing.quantity
      }));
      const { error: ingError } = await supabase.from('product_ingredients').insert(ingredientsToInsert);
      if (ingError) console.error("Error inserting ingredients:", ingError);
    }

    io.emit('product_added', { id: productId });
    res.json({ id: productId });
  });

  app.put('/api/products/:id', async (req, res) => {
    const { name, description, price, categoryId, image, type, inventoryItemId, ingredients } = req.body;
    const productId = req.params.id;

    const { error } = await supabase.from('products').update({
      name, description, price, categoryId, image, type, inventoryItemId: type === 'fixed' ? inventoryItemId : null
    }).eq('id', productId);

    if (error) return res.status(500).json({ error: error.message });

    // Delete existing ingredients
    await supabase.from('product_ingredients').delete().eq('productId', productId);

    if (type === 'composed' && ingredients && ingredients.length > 0) {
      const ingredientsToInsert = ingredients.map((ing: any) => ({
        productId,
        inventoryItemId: ing.inventoryItemId,
        quantity: ing.quantity
      }));
      const { error: ingError } = await supabase.from('product_ingredients').insert(ingredientsToInsert);
      if (ingError) console.error("Error inserting ingredients:", ingError);
    }

    io.emit('product_updated', { id: productId });
    res.json({ success: true });
  });

  app.delete('/api/products/:id', async (req, res) => {
    await supabase.from('product_ingredients').delete().eq('productId', req.params.id);
    const { error } = await supabase.from('products').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    io.emit('product_deleted', req.params.id);
    res.json({ success: true });
  });

  // --- TABLES ---
  app.get('/api/tables', async (req, res) => {
    const { data: tables, error } = await supabase.from('tables').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json(tables);
  });
  app.post('/api/tables', async (req, res) => {
    const { number, loginCode } = req.body;
    const { data, error } = await supabase.from('tables').insert([{ number, loginCode, status: 'livre' }]).select().single();
    if (error) {
      if (error.code === '23505') { // Unique violation
        return res.status(400).json({ error: 'Número ou código já existe' });
      }
      return res.status(500).json({ error: error.message });
    }
    io.emit('table_added', data);
    res.json(data);
  });
  app.put('/api/tables/:id/status', async (req, res) => {
    const { status } = req.body;
    const { data, error } = await supabase.from('tables').update({ status }).eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    io.emit('table_updated', data);
    res.json(data);
  });
  app.delete('/api/tables/:id', async (req, res) => {
    const { error } = await supabase.from('tables').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    io.emit('table_deleted', req.params.id);
    res.json({ success: true });
  });
  app.post('/api/tables/login', async (req, res) => {
    try {
      const { tableId, loginCode } = req.body;
      
      if (!tableId || !loginCode) {
        return res.status(400).json({ success: false, message: 'Mesa e senha são obrigatórios' });
      }

      const { data: table, error } = await supabase.from('tables').select('*').eq('id', tableId).eq('loginCode', loginCode).single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        return res.status(500).json({ success: false, message: error.message });
      }

      if (table) {
        const { data: updatedTable, error: updateError } = await supabase.from('tables').update({ status: 'ocupada' }).eq('id', table.id).select().single();
        if (updateError) return res.status(500).json({ success: false, message: updateError.message });
        
        io.emit('table_updated', updatedTable);
        res.json({ success: true, table: updatedTable });
      } else {
        res.status(401).json({ success: false, message: 'Senha inválida para esta mesa' });
      }
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
  });

  // --- ORDERS ---
  app.get('/api/orders', async (req, res) => {
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        tables (number)
      `)
      .order('createdAt', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const ordersWithItems = await Promise.all(orders.map(async (order: any) => {
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          *,
          products (name, price)
        `)
        .eq('orderId', order.id);

      if (itemsError) {
        console.error("Error fetching items for order", order.id, itemsError);
        return { ...order, tableNumber: order.tables?.number, items: [] };
      }

      const formattedItems = items.map((item: any) => ({
        ...item,
        name: item.products?.name,
        price: item.products?.price
      }));

      return { ...order, tableNumber: order.tables?.number, items: formattedItems };
    }));
    
    res.json(ordersWithItems);
  });

  app.post('/api/orders', async (req, res) => {
    const { tableId, items, total } = req.body;
    
    const { data: order, error } = await supabase.from('orders').insert([{
      tableId, status: 'pending', total
    }]).select().single();

    if (error) return res.status(500).json({ error: error.message });
    const orderId = order.id;
    
    const itemsToInsert = items.map((item: any) => ({
      orderId,
      productId: item.productId,
      quantity: item.quantity,
      notes: item.notes || null
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
    if (itemsError) console.error("Error inserting order items:", itemsError);
    
    // Fetch the complete new order to broadcast
    const { data: newOrder, error: fetchError } = await supabase
      .from('orders')
      .select(`*, tables (number)`)
      .eq('id', orderId)
      .single();

    const { data: orderItems, error: fetchItemsError } = await supabase
      .from('order_items')
      .select(`*, products (name, price)`)
      .eq('orderId', orderId);

    const formattedItems = (orderItems || []).map((item: any) => ({
      ...item,
      name: item.products?.name,
      price: item.products?.price
    }));

    const fullOrder = { ...newOrder, tableNumber: newOrder?.tables?.number, items: formattedItems };
    io.emit('new_order', fullOrder);
    res.json(fullOrder);
  });

  app.put('/api/orders/:id/status', async (req, res) => {
    const { status } = req.body;
    const orderId = req.params.id;
    
    const { data: order, error: orderError } = await supabase.from('orders').select('*').eq('id', orderId).single();
    if (orderError) return res.status(500).json({ error: orderError.message });
    
    // Deduct stock when order starts preparing
    if (status === 'preparing' && order.status === 'pending') {
      const { data: items, error: itemsError } = await supabase.from('order_items').select('*').eq('orderId', orderId);
      
      if (!itemsError && items) {
        for (const item of items) {
          const { data: product, error: productError } = await supabase.from('products').select('*').eq('id', item.productId).single();
          
          if (!productError && product) {
            if (product.type === 'fixed' && product.inventoryItemId) {
              const { data: invItem } = await supabase.from('inventory_items').select('currentStock').eq('id', product.inventoryItemId).single();
              if (invItem) {
                await supabase.from('inventory_items').update({ currentStock: invItem.currentStock - item.quantity }).eq('id', product.inventoryItemId);
              }
            } else if (product.type === 'composed') {
              const { data: ingredients } = await supabase.from('product_ingredients').select('*').eq('productId', product.id);
              if (ingredients) {
                for (const ing of ingredients) {
                  const { data: invItem } = await supabase.from('inventory_items').select('currentStock').eq('id', ing.inventoryItemId).single();
                  if (invItem) {
                    await supabase.from('inventory_items').update({ currentStock: invItem.currentStock - (ing.quantity * item.quantity) }).eq('id', ing.inventoryItemId);
                  }
                }
              }
            }
          }
        }
        io.emit('inventory_updated');
      }
    }
    
    const { error: updateError } = await supabase.from('orders').update({ status }).eq('id', orderId);
    if (updateError) return res.status(500).json({ error: updateError.message });
    
    const { data: updatedOrder, error: fetchError } = await supabase
      .from('orders')
      .select(`*, tables (number)`)
      .eq('id', orderId)
      .single();
    
    const formattedOrder = { ...updatedOrder, tableNumber: updatedOrder?.tables?.number };
    io.emit('order_status_updated', formattedOrder);
    res.json(formattedOrder);
  });

  app.post('/api/orders/pay', async (req, res) => {
    const { tableId, paymentMethod } = req.body;
    
    // Mark all pending/delivered orders for this table as paid
    const { error: updateOrdersError } = await supabase
      .from('orders')
      .update({ paymentStatus: 'paid', paymentMethod })
      .eq('tableId', tableId)
      .eq('paymentStatus', 'pending')
      .neq('status', 'cancelled');
      
    if (updateOrdersError) return res.status(500).json({ error: updateOrdersError.message });
    
    // Free the table
    const { error: updateTableError } = await supabase
      .from('tables')
      .update({ status: 'livre' })
      .eq('id', tableId);
      
    if (updateTableError) return res.status(500).json({ error: updateTableError.message });
    
    const { data: updatedTable } = await supabase.from('tables').select('*').eq('id', tableId).single();
    
    io.emit('table_updated', updatedTable);
    io.emit('orders_paid', { tableId });
    
    res.json({ success: true });
  });

  // --- REPORTS ---
  app.get('/api/reports', async (req, res) => {
    const { startDate, endDate, status, paymentMethod } = req.query;
    
    let query = supabase
      .from('orders')
      .select(`
        *,
        tables (number)
      `)
      .order('createdAt', { ascending: false });

    if (startDate) {
      query = query.gte('createdAt', startDate as string);
    }
    if (endDate) {
      // Add 1 day to include the end date fully
      const end = new Date(endDate as string);
      end.setDate(end.getDate() + 1);
      query = query.lt('createdAt', end.toISOString());
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (paymentMethod) {
      query = query.eq('paymentMethod', paymentMethod);
    }

    const { data: orders, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const formattedOrders = orders.map((order: any) => ({
      ...order,
      tableNumber: order.tables?.number
    }));

    res.json(formattedOrders);
  });

  app.get('/api/dashboard/stats', async (req, res) => {
    try {
      const { count: totalOrders, error: totalError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });

      const { data: revenueData, error: revenueError } = await supabase
        .from('orders')
        .select('total')
        .neq('status', 'cancelled');

      const totalRevenue = revenueData ? revenueData.reduce((sum, order) => sum + order.total, 0) : 0;

      const { count: pendingOrders, error: pendingError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      res.json({
        totalOrders: totalOrders || 0,
        totalRevenue: totalRevenue || 0,
        pendingOrders: pendingOrders || 0
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
