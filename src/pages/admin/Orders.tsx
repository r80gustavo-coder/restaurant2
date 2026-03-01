import { useEffect, useState } from 'react';
import { themeConfig } from '../../config/theme';
import { Check, Clock, ChefHat, X, ChevronDown, ChevronUp, ShoppingBag } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function Orders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          table:tables (
            number
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
        .order('createdAt', { ascending: false });

      if (error) throw error;

      // Transformar os dados para o formato esperado pela UI
      const formattedOrders = data?.map(order => ({
        ...order,
        tableNumber: order.table?.number,
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

    // Realtime subscription for orders
    const channel = supabase
      .channel('admin-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          console.log('Order update:', payload);
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateStatus = async (id: number, status: string) => {
    // Optimistic update
    setOrders(currentOrders => 
      currentOrders.map(order => 
        order.id === id ? { ...order, status } : order
      )
    );

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error updating status:', error);
      // Revert changes by fetching original data
      fetchOrders();
      alert('Erro ao atualizar status do pedido');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'preparing': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'ready': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'delivered': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'preparing': return 'Preparando';
      case 'ready': return 'Pronto';
      case 'delivered': return 'Entregue';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className={`text-2xl font-bold text-${themeConfig.colors.text}`}>Gerenciamento de Pedidos</h2>
        <div className="flex gap-2">
          <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-sm font-medium">Pendentes ({orders.filter(o => o.status === 'pending').length})</span>
          <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">Preparando ({orders.filter(o => o.status === 'preparing').length})</span>
        </div>
      </div>

      <div className="grid gap-4">
        {orders.map((order) => (
          <div key={order.id} className={`bg-${themeConfig.colors.surface} rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-200 hover:shadow-md`}>
            <div 
              className="p-6 flex items-center justify-between cursor-pointer"
              onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
            >
              <div className="flex items-center gap-6">
                <div className={`w-16 h-16 rounded-2xl bg-${themeConfig.colors.primary}/10 flex flex-col items-center justify-center text-${themeConfig.colors.primary}`}>
                  <span className="text-xs font-semibold uppercase tracking-wider">Mesa</span>
                  <span className="text-2xl font-bold">{order.tableNumber}</span>
                </div>
                
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className={`text-lg font-bold text-${themeConfig.colors.text}`}>Pedido #{order.id}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </div>
                  <p className={`text-sm text-${themeConfig.colors.textMuted} flex items-center gap-2`}>
                    <Clock size={14} />
                    {new Date(order.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className={`text-sm text-${themeConfig.colors.textMuted} mb-1`}>Total</p>
                  <p className={`text-xl font-bold text-${themeConfig.colors.text}`}>
                    {themeConfig.currency} {order.total.toFixed(2)}
                  </p>
                </div>

                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  {order.status === 'pending' && (
                    <button 
                      onClick={() => updateStatus(order.id, 'preparing')}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                    >
                      <ChefHat size={18} /> Preparar
                    </button>
                  )}
                  {order.status === 'preparing' && (
                    <button 
                      onClick={() => updateStatus(order.id, 'ready')}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium"
                    >
                      <Check size={18} /> Pronto
                    </button>
                  )}
                  {order.status === 'ready' && (
                    <button 
                      onClick={() => updateStatus(order.id, 'delivered')}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition-colors font-medium"
                    >
                      <Check size={18} /> Entregue
                    </button>
                  )}
                  {order.status === 'pending' && (
                    <button 
                      onClick={() => updateStatus(order.id, 'cancelled')}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                      title="Cancelar"
                    >
                      <X size={20} />
                    </button>
                  )}
                  <button className={`p-2 text-${themeConfig.colors.textMuted} hover:bg-slate-100 rounded-xl transition-colors ml-2`}>
                    {expandedOrderId === order.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                </div>
              </div>
            </div>

            {expandedOrderId === order.id && (
              <div className="px-6 pb-6 pt-2 border-t border-slate-100 bg-slate-50/50">
                <h4 className={`font-semibold text-${themeConfig.colors.text} mb-4`}>Itens do Pedido</h4>
                <div className="space-y-3">
                  {order.items?.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-start p-3 bg-white rounded-xl border border-slate-200">
                      <div>
                        <p className={`font-medium text-${themeConfig.colors.text}`}>
                          <span className="font-bold text-slate-400 mr-2">{item.quantity}x</span>
                          {item.name}
                        </p>
                        {item.notes && (
                          <p className="text-sm text-orange-600 mt-1 bg-orange-50 px-2 py-1 rounded-md inline-block">
                            Obs: {item.notes}
                          </p>
                        )}
                      </div>
                      <p className={`font-medium text-${themeConfig.colors.text}`}>
                        {themeConfig.currency} {(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {orders.length === 0 && (
          <div className={`text-center py-12 bg-${themeConfig.colors.surface} rounded-2xl border border-slate-200`}>
            <ShoppingBag size={48} className={`mx-auto text-${themeConfig.colors.textMuted} mb-4 opacity-50`} />
            <p className={`text-lg text-${themeConfig.colors.textMuted}`}>Nenhum pedido encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
}
