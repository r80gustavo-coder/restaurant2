import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, Package, Users, LogOut, Bell, Tag, Box, DollarSign, FileText, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { themeConfig } from '../config/theme';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize audio
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); // Simple bell sound
    
    const fetchTableNumber = async (tableId: number) => {
      const { data } = await supabase.from('tables').select('number').eq('id', tableId).single();
      return data?.number || '?';
    };

    const channel = supabase
      .channel('admin-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async (payload) => {
        console.log('Notification payload:', payload);
        const order = payload.new as any;
        const oldOrder = payload.old as any;
        let title = '';
        let message = '';
        let type = 'info';

        if (payload.eventType === 'INSERT') {
          const tableNum = await fetchTableNumber(order.tableId);
          title = 'Novo Pedido';
          message = `Mesa ${tableNum} - ${themeConfig.currency} ${order.total.toFixed(2)}`;
          type = 'success';
        } else if (payload.eventType === 'UPDATE') {
          // Check if status changed. 
          // Note: oldOrder might only contain ID depending on replica identity.
          // If oldOrder.status is undefined, we assume it's a status update if the new status is different from what we might expect, 
          // but safer to just check if we have both.
          // If we can't verify change, we might skip or just notify.
          // For now, let's assume if status is present in new payload, it's relevant.
          
          if (order.status && oldOrder && order.status !== oldOrder.status) {
            const tableNum = await fetchTableNumber(order.tableId);
            title = 'Atualização de Pedido';
            const statusMap: Record<string, string> = {
              pending: 'Pendente',
              preparing: 'Preparando',
              ready: 'Pronto',
              delivered: 'Entregue',
              paid: 'Pago',
              cancelled: 'Cancelado'
            };
            message = `Mesa ${tableNum}: Status alterado para ${statusMap[order.status] || order.status}`;
            type = 'info';
          }
        }

        if (title) {
          const newNotification = {
            id: Date.now(),
            title,
            message,
            time: new Date(),
            type,
            read: false
          };
          
          setNotifications(prev => [newNotification, ...prev]);
          
          // Play sound
          if (audioRef.current) {
            try {
              await audioRef.current.play();
            } catch (e) {
              console.error('Error playing sound (user interaction needed?):', e);
            }
          }
        }
      })
      .subscribe((status) => {
        console.log('Notification subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <div className={`min-h-screen bg-${themeConfig.colors.background} flex`}>
      {/* Sidebar */}
      <aside className={`w-64 bg-${themeConfig.colors.surface} border-r border-slate-200 flex flex-col fixed h-full z-20`}>
        <div className="p-6 flex items-center gap-3">
          <img src={themeConfig.logo} alt="Logo" className="w-10 h-10 rounded-lg object-cover" referrerPolicy="no-referrer" />
          <h1 className={`font-bold text-xl text-${themeConfig.colors.text}`}>{themeConfig.name}</h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
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
      <main className="flex-1 flex flex-col min-h-screen ml-64">
        {/* Header */}
        <header className={`h-20 bg-${themeConfig.colors.surface} border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10`}>
          <h2 className={`text-2xl font-bold text-${themeConfig.colors.text}`}>
            {navItems.find(i => i.path === location.pathname)?.label || 'Admin'}
          </h2>
          
          <div className="relative">
            <button 
              onClick={() => {
                setShowNotifications(!showNotifications);
                if (!showNotifications) markAllAsRead();
              }}
              className={`p-2 rounded-full hover:bg-slate-100 text-${themeConfig.colors.textMuted} relative transition-colors`}
            >
              <Bell size={24} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50"
                >
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">Notificações</h3>
                    <button 
                      onClick={() => setNotifications([])}
                      className="text-xs text-slate-500 hover:text-red-500"
                    >
                      Limpar tudo
                    </button>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-slate-400">
                        <Bell size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Nenhuma notificação</p>
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div key={notif.id} className={`p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors ${notif.read ? 'opacity-70' : 'bg-blue-50/50'}`}>
                          <div className="flex gap-3">
                            <div className={`mt-1 p-1.5 rounded-full ${
                              notif.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 
                              notif.type === 'warning' ? 'bg-orange-100 text-orange-600' : 
                              'bg-blue-100 text-blue-600'
                            }`}>
                              {notif.type === 'success' ? <CheckCircle size={14} /> : 
                               notif.type === 'warning' ? <AlertCircle size={14} /> : 
                               <Clock size={14} />}
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-slate-800">{notif.title}</h4>
                              <p className="text-xs text-slate-500 mt-0.5">{notif.message}</p>
                              <span className="text-[10px] text-slate-400 mt-2 block">
                                {notif.time.toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-8 relative">
          <Outlet />

          {/* Notifications Toast */}
          <div className="fixed bottom-8 right-8 z-50 flex flex-col gap-3 pointer-events-none">
            <AnimatePresence>
              {notifications.filter(n => !n.read).slice(0, 3).map((notif) => (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 50 }}
                  className={`pointer-events-auto bg-white p-4 rounded-xl shadow-lg border-l-4 w-80 flex items-start gap-4 ${
                    notif.type === 'success' ? 'border-emerald-500' : 
                    notif.type === 'warning' ? 'border-orange-500' : 
                    'border-blue-500'
                  }`}
                >
                  <div className={`p-2 rounded-full ${
                    notif.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 
                    notif.type === 'warning' ? 'bg-orange-100 text-orange-600' : 
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {notif.type === 'success' ? <CheckCircle size={18} /> : 
                     notif.type === 'warning' ? <AlertCircle size={18} /> : 
                     <Bell size={18} />}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800 text-sm">{notif.title}</h4>
                    <p className="text-xs text-slate-500 mt-1">{notif.message}</p>
                  </div>
                  <button 
                    onClick={() => setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n))}
                    className="text-slate-400 hover:text-slate-600"
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
