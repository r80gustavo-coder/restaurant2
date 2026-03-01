import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

// Layouts
import AdminLayout from './layouts/AdminLayout';
import CustomerLayout from './layouts/CustomerLayout';

// Admin Pages
import Dashboard from './pages/admin/Dashboard';
import Orders from './pages/admin/Orders';
import Products from './pages/admin/Products';
import Categories from './pages/admin/Categories';
import Inventory from './pages/admin/Inventory';
import Checkout from './pages/admin/Checkout';
import Reports from './pages/admin/Reports';
import Login from './pages/admin/Login';
import Tables from './pages/admin/Tables';

// Customer Pages
import Menu from './pages/customer/Menu';
import Cart from './pages/customer/Cart';
import OrderStatus from './pages/customer/OrderStatus';
import TableLogin from './pages/customer/TableLogin';

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);
    return () => {
      newSocket.disconnect();
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Admin Routes */}
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin" element={<AdminLayout socket={socket} />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard socket={socket} />} />
          <Route path="orders" element={<Orders socket={socket} />} />
          <Route path="products" element={<Products socket={socket} />} />
          <Route path="categories" element={<Categories socket={socket} />} />
          <Route path="inventory" element={<Inventory socket={socket} />} />
          <Route path="tables" element={<Tables socket={socket} />} />
          <Route path="checkout" element={<Checkout socket={socket} />} />
          <Route path="reports" element={<Reports socket={socket} />} />
        </Route>

        {/* Customer Routes */}
        <Route path="/login" element={<TableLogin />} />
        <Route path="/" element={<CustomerLayout socket={socket} />}>
          <Route index element={<Menu socket={socket} />} />
          <Route path="cart" element={<Cart socket={socket} />} />
          <Route path="status" element={<OrderStatus socket={socket} />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
