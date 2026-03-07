import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { themeConfig } from '../../config/theme';
import { supabase } from '../../lib/supabase';
import { LogOut, MapPin, Package, CheckCircle2, Clock, Phone } from 'lucide-react';

export default function DriverDashboard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const driverId = localStorage.getItem('driverId');
  const driverName = localStorage.getItem('driverName');

  useEffect(() => {
    if (!driverId) {
      navigate('/driver/login');
      return;
    }
    fetchOrders();

    const channel = supabase
      .channel('driver-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => fetchOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId, navigate]);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customer:customers (
            name,
            phone
          ),
          items:order_items (
            quantity,
            product:products (name)
          )
        `)
        .eq('type', 'online')
        .in('status', ['ready', 'out_for_delivery'])
        .order('createdAt', { ascending: false });

      if (error) throw error;

      // Filter orders: either unassigned (ready) or assigned to this driver (out_for_delivery)
      const filteredOrders = data?.filter(order => 
        (order.status === 'ready' && !order.driver_id) || 
        (order.status === 'out_for_delivery' && order.driver_id === driverId)
      ) || [];

      setOrders(filteredOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const acceptDelivery = async (orderId: number) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'out_for_delivery',
          driver_id: driverId 
        })
        .eq('id', orderId);

      if (error) throw error;
      fetchOrders();
    } catch (error) {
      console.error('Error accepting delivery:', error);
      alert('Erro ao aceitar entrega.');
    }
  };

  const completeDelivery = async (orderId: number) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'delivered' })
        .eq('id', orderId);

      if (error) throw error;
      fetchOrders();
    } catch (error) {
      console.error('Error completing delivery:', error);
      alert('Erro ao finalizar entrega.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('driverId');
    localStorage.removeItem('driverName');
    navigate('/driver/login');
  };

  return (
    <div className={`min-h-screen bg-${themeConfig.colors.background}`}>
      <header className={`bg-${themeConfig.colors.surface} border-b border-slate-200 p-4 sticky top-0 z-10`}>
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <div>
            <h1 className={`text-xl font-bold text-${themeConfig.colors.text}`}>Entregas</h1>
            <p className={`text-sm text-${themeConfig.colors.textMuted}`}>Olá, {driverName}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut size={24} />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        {orders.length === 0 ? (
          <div className="text-center py-12">
            <div className={`w-20 h-20 bg-${themeConfig.colors.primary}/10 rounded-full flex items-center justify-center text-${themeConfig.colors.primary} mx-auto mb-4`}>
              <Package size={40} />
            </div>
            <h2 className={`text-xl font-bold text-${themeConfig.colors.text} mb-2`}>Nenhuma entrega no momento</h2>
            <p className={`text-${themeConfig.colors.textMuted}`}>Aguarde novos pedidos ficarem prontos.</p>
          </div>
        ) : (
          orders.map(order => (
            <div key={order.id} className={`bg-${themeConfig.colors.surface} rounded-2xl shadow-sm border border-slate-200 overflow-hidden`}>
              <div className="p-4 border-b border-slate-100 flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pedido #{order.id}</span>
                  <h3 className={`font-bold text-lg text-${themeConfig.colors.text} mt-1`}>{order.customer?.name}</h3>
                </div>
                {order.status === 'out_for_delivery' ? (
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold flex items-center gap-1">
                    <Clock size={14} /> Em Rota
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold flex items-center gap-1">
                    <Package size={14} /> Disponível
                  </span>
                )}
              </div>
              
              <div className="p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="text-slate-400 mt-0.5" size={20} />
                  <div>
                    <p className="text-sm font-medium text-slate-700">Endereço de Entrega</p>
                    <p className="text-slate-600">{order.delivery_address?.full || 'Não informado'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="text-slate-400 mt-0.5" size={20} />
                  <div>
                    <p className="text-sm font-medium text-slate-700">Contato</p>
                    <p className="text-slate-600">{order.customer?.phone}</p>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">Itens do Pedido</p>
                  <ul className="space-y-1">
                    {order.items?.map((item: any, idx: number) => (
                      <li key={idx} className="text-sm text-slate-700">
                        <span className="font-medium">{item.quantity}x</span> {item.product?.name}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100">
                {order.status === 'ready' ? (
                  <button 
                    onClick={() => acceptDelivery(order.id)}
                    className={`w-full py-3 bg-${themeConfig.colors.primary} text-white font-bold rounded-xl hover:bg-emerald-600 transition-colors shadow-sm`}
                  >
                    Aceitar Entrega
                  </button>
                ) : (
                  <button 
                    onClick={() => completeDelivery(order.id)}
                    className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={20} />
                    Confirmar Entrega
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
