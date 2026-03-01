import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, Package, Users, LogOut, Bell, Tag, Box, DollarSign, FileText } from 'lucide-react';
import { themeConfig } from '../config/theme';
import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminLayout({ socket }: { socket: Socket | null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!socket) return;

    socket.on('new_order', (order) => {
      setNotifications(prev => [{
        id: Date.now(),
        title: 'Novo Pedido',
        message: `Mesa ${order.tableNumber} - R$ ${order.total.toFixed(2)}`,
        time: new Date()
      }, ...prev]);
    });

    return () => {
      socket.off('new_order');
    };
  }, [socket]);

  const navItems = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/orders', icon: ShoppingBag, label: 'Pedidos' },
    { path: '/admin/checkout', icon: DollarSign, label: 'Caixa' },
    { path: '/admin/products', icon: Package, label: 'Produtos' },
    { path: '/admin/categories', icon: Tag, label: 'Categorias' },
    { path: '/admin/inventory', icon: Box, label: 'Estoque' },
    { path: '/admin/tables', icon: Users, label: 'Mesas' },
    { path: '/admin/reports', icon: FileText, label: 'Relatórios' },
  ];

  return (
    <div className={`min-h-screen bg-${themeConfig.colors.background} flex`}>
      {/* Sidebar */}
      <aside className={`w-64 bg-${themeConfig.colors.surface} border-r border-slate-200 flex flex-col`}>
        <div className="p-6 flex items-center gap-3">
          <img src={themeConfig.logo} alt="Logo" className="w-10 h-10 rounded-lg object-cover" referrerPolicy="no-referrer" />
          <h1 className={`font-bold text-xl text-${themeConfig.colors.text}`}>{themeConfig.name}</h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  isActive 
                    ? `bg-${themeConfig.colors.primary} text-white` 
                    : `text-${themeConfig.colors.textMuted} hover:bg-slate-100`
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4">
          <button 
            onClick={() => navigate('/admin/login')}
            className={`flex items-center gap-3 px-4 py-3 w-full rounded-xl text-${themeConfig.colors.textMuted} hover:bg-red-50 hover:text-red-600 transition-colors`}
          >
            <LogOut size={20} />
            <span className="font-medium">Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className={`h-20 bg-${themeConfig.colors.surface} border-b border-slate-200 flex items-center justify-between px-8`}>
          <h2 className={`text-2xl font-bold text-${themeConfig.colors.text}`}>
            {navItems.find(i => i.path === location.pathname)?.label || 'Admin'}
          </h2>
          
          <div className="relative">
            <button className={`p-2 rounded-full hover:bg-slate-100 text-${themeConfig.colors.textMuted} relative`}>
              <Bell size={24} />
              {notifications.length > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
              )}
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-8 relative">
          <Outlet />

          {/* Notifications Toast */}
          <div className="fixed bottom-8 right-8 z-50 flex flex-col gap-3">
            <AnimatePresence>
              {notifications.slice(0, 3).map((notif) => (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, y: 50, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                  className={`bg-${themeConfig.colors.surface} p-4 rounded-xl shadow-lg border border-slate-100 w-80 flex items-start gap-4`}
                >
                  <div className={`p-2 bg-${themeConfig.colors.primary}/10 text-${themeConfig.colors.primary} rounded-lg`}>
                    <Bell size={20} />
                  </div>
                  <div className="flex-1">
                    <h4 className={`font-semibold text-${themeConfig.colors.text}`}>{notif.title}</h4>
                    <p className={`text-sm text-${themeConfig.colors.textMuted}`}>{notif.message}</p>
                  </div>
                  <button 
                    onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
                    className={`text-${themeConfig.colors.textMuted} hover:text-slate-700`}
                  >
                    &times;
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
