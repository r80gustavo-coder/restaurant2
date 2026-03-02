import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, ShoppingCart, ClipboardList, LogOut } from 'lucide-react';
import { themeConfig } from '../config/theme';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function CustomerLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const tableId = sessionStorage.getItem('tableId');
    if (!tableId) {
      navigate('/login');
      return;
    }

    // Monitor table status for auto-logout
    const channel = supabase
      .channel('customer-layout-table-status')
      .on(
        'postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'tables', filter: `id=eq.${tableId}` }, 
        (payload) => {
          console.log('Table update received:', payload);
          const newTable = payload.new as any;
          if (newTable.status === 'livre') {
            console.log('Table is free, logging out...');
            // Table was freed (checkout completed), log out user
            sessionStorage.removeItem('tableId');
            sessionStorage.removeItem('tableNumber');
            sessionStorage.removeItem('cart');
            navigate('/login');
          }
        }
      )
      .subscribe((status) => {
        console.log('Customer table subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate]);

  const navItems = [
    { path: '/', icon: Home, label: 'Cardápio' },
    { path: '/cart', icon: ShoppingCart, label: 'Carrinho' },
    { path: '/status', icon: ClipboardList, label: 'Pedidos' },
  ];

  return (
    <div className={`min-h-screen bg-${themeConfig.colors.background} flex flex-col pb-20`}>
      {/* Header */}
      <header className={`bg-${themeConfig.colors.surface} shadow-sm px-4 py-4 sticky top-0 z-50 flex justify-between items-center`}>
        <div className="flex items-center gap-3">
          <img src={themeConfig.logo} alt="Logo" className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
          <div>
            <h1 className={`font-bold text-lg text-${themeConfig.colors.text}`}>{themeConfig.name}</h1>
            <p className={`text-xs text-${themeConfig.colors.textMuted}`}>Faça seu pedido</p>
          </div>
        </div>
        <button
          onClick={() => {
            sessionStorage.removeItem('tableId');
            sessionStorage.removeItem('tableNumber');
            sessionStorage.removeItem('cart');
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
