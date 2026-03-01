import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

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
import Login from './pages/admin/Login';
import Tables from './pages/admin/Tables';

// Customer Pages
import Menu from './pages/customer/Menu';
import Cart from './pages/customer/Cart';
import OrderStatus from './pages/customer/OrderStatus';
import TableLogin from './pages/customer/TableLogin';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Admin Routes */}
        <Route path="/admin/login" element={<Login />} />
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
