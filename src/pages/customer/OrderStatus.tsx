import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { themeConfig } from '../../config/theme';
import { Clock, ChefHat, CheckCircle2, PackageCheck, Bike } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function OrderStatus() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);

  const fetchOrders = async () => {
    const orderType = sessionStorage.getItem('orderType');
    const tableId = sessionStorage.getItem('tableId');
    const customerId = sessionStorage.getItem('customerId');

    if (!orderType && !tableId && !customerId) {
      navigate('/login');
      return;
    }

    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          driver:drivers (
            name,
            phone
          ),
          items:order_items (
            id,
            quantity,
            notes,
            product:products (
              name,
              price
            )
          )
        `)
        .neq('paymentStatus', 'paid') // Filter out paid orders (previous sessions)
        .neq('status', 'chat_unread')
        .neq('status', 'chat_read')
        .order('createdAt', { ascending: false });

      if (orderType === 'table' && tableId) {
        query = query.eq('tableId', parseInt(tableId));
      } else if (orderType === 'online' && customerId) {
        query = query.eq('customer_id', parseInt(customerId));
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transformar os dados para o formato esperado pela UI
      const formattedOrders = data?.map(order => ({
        ...order,
        items: order.items.map((item: any) => ({
          ...item,
          name: item.product?.name,
          price: item.product?.price
        }))
      }));

      setOrders(formattedOrders || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  useEffect(() => {
    fetchOrders();

    const orderType = sessionStorage.getItem('orderType');
    const tableId = sessionStorage.getItem('tableId');
    const customerId = sessionStorage.getItem('customerId');

    let filter = '';
    if (orderType === 'table' && tableId) {
      filter = `tableId=eq.${tableId}`;
    } else if (orderType === 'online' && customerId) {
      filter = `customer_id=eq.${parseInt(customerId)}`;
    }

    if (!filter) return;

    // Realtime subscription for orders
    const channel = supabase
      .channel('customer-orders')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: filter
        },
        (payload) => {
          console.log('Order update:', payload);
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={24} className="text-orange-500" />;
      case 'preparing': return <ChefHat size={24} className="text-blue-500" />;
      case 'ready': return <CheckCircle2 size={24} className="text-emerald-500" />;
      case 'out_for_delivery': return <Bike size={24} className="text-blue-500" />;
      case 'delivered': return <PackageCheck size={24} className="text-slate-500" />;
      default: return <Clock size={24} className="text-slate-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Aguardando Preparo';
      case 'preparing': return 'Na Cozinha';
      case 'ready': return 'Pronto para Entrega';
      case 'out_for_delivery': return 'Em Rota de Entrega';
      case 'delivered': return 'Entregue';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-orange-50 border-orange-200';
      case 'preparing': return 'bg-blue-50 border-blue-200';
      case 'ready': return 'bg-emerald-50 border-emerald-200';
      case 'out_for_delivery': return 'bg-blue-50 border-blue-200';
      case 'delivered': return 'bg-slate-50 border-slate-200';
      case 'cancelled': return 'bg-red-50 border-red-200';
      default: return 'bg-slate-50 border-slate-200';
    }
  };

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className={`w-24 h-24 bg-${themeConfig.colors.primary}/10 rounded-full flex items-center justify-center text-${themeConfig.colors.primary} mb-6`}>
          <Clock size={48} />
        </div>
        <h2 className={`text-2xl font-black text-${themeConfig.colors.text} mb-2`}>Nenhum pedido ainda</h2>
        <p className={`text-${themeConfig.colors.textMuted} mb-8 font-medium`}>Você ainda não fez nenhum pedido.</p>
        <button 
          onClick={() => navigate('/')}
          className={`px-8 py-4 bg-${themeConfig.colors.primary} text-white font-bold rounded-2xl shadow-lg shadow-${themeConfig.colors.primary}/30 active:scale-95 transition-transform`}
        >
          Fazer Pedido
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24">
      <h2 className={`text-2xl font-black text-${themeConfig.colors.text} mb-6 px-2`}>Meus Pedidos</h2>
      
      <div className="space-y-6">
        {orders.map((order) => (
          <div key={order.id} className={`bg-white rounded-3xl shadow-sm border ${getStatusColor(order.status)} overflow-hidden transition-all`}>
            <div className="p-6 border-b border-slate-100/50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl bg-white shadow-sm border border-slate-100`}>
                  {getStatusIcon(order.status)}
                </div>
                <div>
                  <h3 className={`font-black text-lg text-${themeConfig.colors.text} leading-tight mb-1`}>
                    Pedido #{order.id}
                  </h3>
                  <p className={`text-sm font-bold text-${themeConfig.colors.textMuted}`}>
                    {getStatusText(order.status)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-xs font-bold text-slate-400 uppercase tracking-widest mb-1`}>Total</p>
                <p className={`font-black text-xl text-${themeConfig.colors.primary}`}>
                  {themeConfig.currency} {order.total.toFixed(2)}
                </p>
              </div>
            </div>
            
            <div className="p-6 bg-slate-50/50">
              {order.type === 'online' && order.driver && (
                <div className="mb-6 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                  <h4 className={`text-xs font-bold text-slate-400 uppercase tracking-widest mb-2`}>Entregador</h4>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`font-bold text-${themeConfig.colors.text}`}>{order.driver.name}</p>
                      <p className={`text-sm text-${themeConfig.colors.textMuted}`}>{order.driver.phone}</p>
                    </div>
                  </div>
                </div>
              )}
              <h4 className={`text-xs font-bold text-slate-400 uppercase tracking-widest mb-4`}>Itens do Pedido</h4>
              <div className="space-y-3">
                {order.items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between items-start">
                    <p className={`font-medium text-${themeConfig.colors.text}`}>
                      <span className="font-bold text-slate-400 mr-2">{item.quantity}x</span>
                      {item.name}
                    </p>
                    <p className={`font-bold text-${themeConfig.colors.textMuted}`}>
                      {themeConfig.currency} {(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-4 border-t border-slate-200/50 flex justify-between items-center">
                <p className={`text-xs font-bold text-slate-400 uppercase tracking-widest`}>Realizado em</p>
                <p className={`text-sm font-medium text-${themeConfig.colors.textMuted}`}>
                  {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
