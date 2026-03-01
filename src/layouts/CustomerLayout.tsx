import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, ShoppingCart, ClipboardList } from 'lucide-react';
import { themeConfig } from '../config/theme';

export default function CustomerLayout() {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Home, label: 'Cardápio' },
    { path: '/cart', icon: ShoppingCart, label: 'Carrinho' },
    { path: '/status', icon: ClipboardList, label: 'Pedidos' },
  ];

  return (
    <div className={`min-h-screen bg-${themeConfig.colors.background} flex flex-col pb-20`}>
      {/* Header */}
      <header className={`bg-${themeConfig.colors.surface} shadow-sm px-4 py-4 sticky top-0 z-50`}>
        <div className="flex items-center gap-3">
          <img src={themeConfig.logo} alt="Logo" className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
          <div>
            <h1 className={`font-bold text-lg text-${themeConfig.colors.text}`}>{themeConfig.name}</h1>
            <p className={`text-xs text-${themeConfig.colors.textMuted}`}>Faça seu pedido</p>
          </div>
        </div>
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
