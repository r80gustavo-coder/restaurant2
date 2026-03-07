import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, ShoppingCart, ClipboardList, LogOut, Bell, BellRing } from 'lucide-react';
import { themeConfig } from '../config/theme';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import CustomerChat from '../components/CustomerChat';

export default function CustomerLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [notification, setNotification] = useState<{title: string, message: string} | null>(null);
  const [isCallingWaiter, setIsCallingWaiter] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const soundEnabledRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    const orderType = sessionStorage.getItem('orderType');
    const tableId = sessionStorage.getItem('tableId');
    const customerId = sessionStorage.getItem('customerId');

    if (!orderType && !tableId && !customerId) {
      navigate('/login');
      return;
    }

    if (orderType === 'table' && tableId) {
      // Monitor table status for auto-logout and order status changes
      const channel = supabase
        .channel(`customer-layout-${tableId}`)
        .on(
          'postgres_changes', 
          { event: 'UPDATE', schema: 'public', table: 'tables', filter: `id=eq.${tableId}` }, 
          (payload) => {
            const newTable = payload.new as any;
            if (newTable.status === 'livre') {
              sessionStorage.removeItem('tableId');
              sessionStorage.removeItem('tableNumber');
              sessionStorage.removeItem('cart');
              sessionStorage.removeItem('orderType');
              navigate('/login');
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'orders', filter: `tableId=eq.${tableId}` },
          (payload) => {
            const newOrder = payload.new as any;
            const oldOrder = payload.old as any;
            
            if (newOrder.status && oldOrder.status && newOrder.status !== oldOrder.status) {
              if (['preparing', 'ready', 'delivered'].includes(newOrder.status)) {
                const statusMap: Record<string, string> = {
                  preparing: 'Preparando',
                  ready: 'Pronto',
                  delivered: 'Entregue'
                };
                
                setNotification({
                  title: 'Atualização do Pedido',
                  message: `Seu pedido agora está: ${statusMap[newOrder.status]}`
                });
                
                if (audioRef.current && soundEnabledRef.current) {
                  audioRef.current.currentTime = 0;
                  audioRef.current.play().catch(e => console.log('Audio blocked', e));
                }
                
                setTimeout(() => {
                  setNotification(null);
                }, 5000);
              }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else if (orderType === 'online' && customerId) {
       const channel = supabase
        .channel(`customer-layout-online-${customerId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'orders', filter: `customer_id=eq.${customerId}` },
          (payload) => {
            const newOrder = payload.new as any;
            const oldOrder = payload.old as any;
            
            if (newOrder.status && oldOrder.status && newOrder.status !== oldOrder.status) {
              if (['preparing', 'ready', 'delivered'].includes(newOrder.status)) {
                const statusMap: Record<string, string> = {
                  preparing: 'Preparando',
                  ready: 'Pronto',
                  delivered: 'Entregue'
                };
                
                setNotification({
                  title: 'Atualização do Pedido',
                  message: `Seu pedido agora está: ${statusMap[newOrder.status]}`
                });
                
                if (audioRef.current && soundEnabledRef.current) {
                  audioRef.current.currentTime = 0;
                  audioRef.current.play().catch(e => console.log('Audio blocked', e));
                }
                
                setTimeout(() => {
                  setNotification(null);
                }, 5000);
              }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [navigate]);

  const navItems = [
    { path: '/', icon: Home, label: 'Cardápio' },
    { path: '/cart', icon: ShoppingCart, label: 'Carrinho' },
    { path: '/status', icon: ClipboardList, label: 'Pedidos' },
  ];

  const handleCallWaiter = async () => {
    const tableId = sessionStorage.getItem('tableId');
    const orderType = sessionStorage.getItem('orderType');
    if (!tableId || orderType !== 'table') return;

    setIsCallingWaiter(true);
    try {
      const { error } = await supabase
        .from('tables')
        .update({ needs_waiter: true })
        .eq('id', tableId);

      if (error) throw error;
      
      setNotification({
        title: 'Garçom Chamado',
        message: 'Um garçom está a caminho da sua mesa.'
      });
      if (audioRef.current && soundEnabledRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(e => console.log('Audio blocked', e));
      }
      setTimeout(() => setNotification(null), 5000);
    } catch (error) {
      console.error('Error calling waiter:', error);
      alert('Erro ao chamar o garçom. Tente novamente.');
    } finally {
      setTimeout(() => setIsCallingWaiter(false), 5000); // Prevent spam
    }
  };

  const enableSound = () => {
    setSoundEnabled(true);
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.log('Audio blocked', e));
    }
  };

  return (
    <div className={`min-h-screen bg-${themeConfig.colors.background} flex flex-col pb-20`} onClick={() => { 
      if (!soundEnabled) {
        setSoundEnabled(true);
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(e => console.log('Audio blocked', e));
        }
      }
    }}>
      <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" preload="auto" />
      {/* Header */}
      <header className={`bg-${themeConfig.colors.surface} shadow-sm px-4 py-4 sticky top-0 z-50 flex justify-between items-center`}>
        <div className="flex items-center gap-3">
          <img src={themeConfig.logo} alt="Logo" className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
          <div>
            <h1 className={`font-bold text-lg text-${themeConfig.colors.text}`}>{themeConfig.name}</h1>
            <p className={`text-xs text-${themeConfig.colors.textMuted}`}>
              {sessionStorage.getItem('orderType') === 'online' ? 'Delivery & Retirada' : `Mesa ${sessionStorage.getItem('tableNumber')}`}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            sessionStorage.removeItem('tableId');
            sessionStorage.removeItem('tableNumber');
            sessionStorage.removeItem('cart');
            sessionStorage.removeItem('orderType');
            sessionStorage.removeItem('customerId');
            navigate('/login');
          }}
          className="p-2 text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1 text-sm font-medium"
          title="Sair do sistema"
        >
          <LogOut size={18} />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      <CustomerChat />

      {/* Call Waiter Floating Button - Only for Table Orders */}
      {sessionStorage.getItem('orderType') === 'table' && (
        <button
          onClick={handleCallWaiter}
          disabled={isCallingWaiter}
          className={`fixed bottom-40 right-6 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${
            isCallingWaiter 
              ? 'bg-slate-300 text-slate-500 scale-95' 
              : 'bg-red-500 hover:bg-red-600 text-white hover:scale-105 hover:shadow-xl'
          }`}
          title="Chamar Garçom"
        >
          <BellRing size={24} className={isCallingWaiter ? '' : 'animate-pulse'} />
        </button>
      )}

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -50, x: '-50%' }}
            className={`fixed top-20 left-1/2 z-[60] w-[90%] max-w-sm bg-${themeConfig.colors.surface} rounded-2xl shadow-2xl border-l-4 border-${themeConfig.colors.primary} p-4 flex items-start gap-3`}
          >
            <div className={`p-2 bg-${themeConfig.colors.primary}/10 rounded-xl text-${themeConfig.colors.primary}`}>
              <Bell size={20} />
            </div>
            <div className="flex-1">
              <h4 className={`font-bold text-${themeConfig.colors.text} text-sm`}>{notification.title}</h4>
              <p className={`text-${themeConfig.colors.textMuted} text-xs mt-1`}>{notification.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className={`fixed bottom-0 w-full bg-${themeConfig.colors.surface} border-t border-slate-200 flex justify-around py-3 px-6 z-50`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 transition-colors ${
                isActive 
                  ? `text-${themeConfig.colors.primary}` 
                  : `text-${themeConfig.colors.textMuted}`
              }`}
            >
              <Icon size={24} className={isActive ? 'fill-current' : ''} />
              <span className="text-[10px] font-medium uppercase tracking-wider">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
