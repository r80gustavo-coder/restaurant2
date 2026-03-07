import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { supabase } from './lib/supabase';

// Layouts
import AdminLayout from './layouts/AdminLayout';
import CustomerLayout from './layouts/CustomerLayout';

// Admin Pages
import Dashboard from './pages/admin/Dashboard';
import Orders from './pages/admin/Orders';
import Products from './pages/admin/Products';
import Categories from './pages/admin/Categories';
import Customers from './pages/admin/Customers';
import Inventory from './pages/admin/Inventory';
import Checkout from './pages/admin/Checkout';
import Reports from './pages/admin/Reports';
import Chat from './pages/admin/Chat';
import Login from './pages/admin/Login';
import Tables from './pages/admin/Tables';
import Staff from './pages/admin/Staff';
import Kitchen from './pages/admin/Kitchen';
import Waiter from './pages/admin/Waiter';

// Customer Pages
import Menu from './pages/customer/Menu';
import Cart from './pages/customer/Cart';
import OrderStatus from './pages/customer/OrderStatus';
import TableLogin from './pages/customer/TableLogin';

export default function App() {
  useEffect(() => {
    const setupDb = async () => {
      await supabase.rpc('exec_sql', {
        query: `
          CREATE TABLE IF NOT EXISTS staff (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('admin', 'cook', 'waiter')),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          INSERT INTO staff (name, username, password, role)
          VALUES ('Administrador', 'admin', 'admin', 'admin')
          ON CONFLICT (username) DO NOTHING;

          ALTER TABLE tables ADD COLUMN IF NOT EXISTS needs_waiter BOOLEAN DEFAULT false;
        `
      });
    };
    setupDb();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Admin Routes */}
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin/kitchen" element={<Kitchen />} />
        <Route path="/admin/waiter" element={<Waiter />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="orders" element={<Orders />} />
          <Route path="products" element={<Products />} />
          <Route path="categories" element={<Categories />} />
          <Route path="customers" element={<Customers />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="tables" element={<Tables />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="reports" element={<Reports />} />
          <Route path="chat" element={<Chat />} />
          <Route path="staff" element={<Staff />} />
        </Route>

        {/* Customer Routes */}
        <Route path="/login" element={<TableLogin />} />
        <Route path="/" element={<CustomerLayout />}>
          <Route index element={<Menu />} />
          <Route path="cart" element={<Cart />} />
          <Route path="status" element={<OrderStatus />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
