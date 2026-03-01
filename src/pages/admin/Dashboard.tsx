import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { themeConfig } from '../../config/theme';
import { TrendingUp, ShoppingBag, Clock, DollarSign, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../../lib/supabase';

export default function Dashboard({ socket }: { socket: Socket | null }) {
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
  });
  const [tables, setTables] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  const fetchStats = async () => {
    try {
      // Buscar todos os pedidos
      const { data: orders, error } = await supabase
        .from('orders')
        .select('*');

      if (error) throw error;

      const totalOrders = orders?.length || 0;
      const totalRevenue = orders?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;
      const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0;

      setStats({
        totalOrders,
        totalRevenue,
        pendingOrders
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchRecentOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          table:tables (
            number
          )
        `)
        .order('createdAt', { ascending: false })
        .limit(5);

      if (error) throw error;

      const formattedOrders = data?.map(order => ({
        ...order,
        tableNumber: order.table?.number
      })) || [];

      setRecentOrders(formattedOrders);
    } catch (error) {
      console.error('Error fetching recent orders:', error);
    }
  };

  const fetchTables = async () => {
    try {
      const { data, error } = await supabase
        .from('tables')
        .select('*');
      
      if (error) throw error;
      setTables(data || []);
    } catch (error) {
      console.error('Error fetching tables:', error);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchRecentOrders();
    fetchTables();

    // Realtime subscriptions
    const ordersChannel = supabase
      .channel('dashboard-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchStats();
        fetchRecentOrders();
      })
      .subscribe();

    const tablesChannel = supabase
      .channel('dashboard-tables')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => {
        fetchTables();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(tablesChannel);
    };
  }, []);

  const data = [
    { name: 'Seg', vendas: 4000 },
    { name: 'Ter', vendas: 3000 },
    { name: 'Qua', vendas: 2000 },
    { name: 'Qui', vendas: 2780 },
    { name: 'Sex', vendas: 1890 },
    { name: 'Sáb', vendas: 2390 },
    { name: 'Dom', vendas: 3490 },
  ];

  const statCards = [
    { title: 'Faturamento', value: `${themeConfig.currency} ${stats.totalRevenue.toFixed(2)}`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { title: 'Total de Pedidos', value: stats.totalOrders, icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-100' },
    { title: 'Pedidos Pendentes', value: stats.pendingOrders, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-100' },
    { title: 'Mesas Ocupadas', value: `${tables.filter(t => t.status === 'ocupada').length} / ${tables.length}`, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-100' },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className={`bg-${themeConfig.colors.surface} p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4`}>
              <div className={`p-4 rounded-xl ${stat.bg} ${stat.color}`}>
                <Icon size={24} />
              </div>
              <div>
                <p className={`text-sm font-medium text-${themeConfig.colors.textMuted}`}>{stat.title}</p>
                <h3 className={`text-2xl font-bold text-${themeConfig.colors.text}`}>{stat.value}</h3>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className={`lg:col-span-2 bg-${themeConfig.colors.surface} p-6 rounded-2xl shadow-sm border border-slate-100`}>
          <h3 className={`text-lg font-bold text-${themeConfig.colors.text} mb-6`}>Vendas da Semana</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dx={-10} />
                <Tooltip 
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="vendas" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`bg-${themeConfig.colors.surface} p-6 rounded-2xl shadow-sm border border-slate-100`}>
          <h3 className={`text-lg font-bold text-${themeConfig.colors.text} mb-6`}>Últimos Pedidos</h3>
          <div className="space-y-4">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full bg-${themeConfig.colors.primary}/10 flex items-center justify-center text-${themeConfig.colors.primary} font-bold`}>
                    {order.tableNumber}
                  </div>
                  <div>
                    <p className={`font-semibold text-${themeConfig.colors.text}`}>Mesa {order.tableNumber}</p>
                    <p className={`text-xs text-${themeConfig.colors.textMuted}`}>
                      {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-${themeConfig.colors.text}`}>
                    {themeConfig.currency} {order.total.toFixed(2)}
                  </p>
                  <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${
                    order.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                    order.status === 'preparing' ? 'bg-blue-100 text-blue-700' :
                    order.status === 'ready' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {order.status === 'pending' ? 'Pendente' :
                     order.status === 'preparing' ? 'Preparando' :
                     order.status === 'ready' ? 'Pronto' : 'Entregue'}
                  </span>
                </div>
              </div>
            ))}
            {recentOrders.length === 0 && (
              <p className={`text-center text-${themeConfig.colors.textMuted} py-8`}>Nenhum pedido recente.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
