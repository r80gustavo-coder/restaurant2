import { useEffect, useState, useRef } from 'react';
import { themeConfig } from '../../config/theme';
import { Check, Clock, ChefHat, LogOut, Volume2, VolumeX } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function Kitchen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const navigate = useNavigate();
  const staffName = localStorage.getItem('staffName') || 'Cozinheiro';
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const orderStatusesRef = useRef<Record<number, string>>({});

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
              name
            )
          )
        `)
        .in('status', ['pending', 'preparing'])
        .order('createdAt', { ascending: true });

      if (error) throw error;

      const formattedOrders = data?.map(order => ({
        ...order,
        tableNumber: order.table?.number,
        items: order.items.map((item: any) => ({
          ...item,
          name: item.product?.name
        }))
      }));

      setOrders(formattedOrders || []);
      
      if (data) {
        const statuses: Record<number, string> = {};
        data.forEach(o => statuses[o.id] = o.status);
        orderStatusesRef.current = statuses;
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel('kitchen-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          const newOrder = payload.new as any;
          const oldStatus = payload.old?.status || orderStatusesRef.current[newOrder.id];
          
          if (payload.eventType === 'INSERT' || (payload.eventType === 'UPDATE' && newOrder.status === 'pending' && oldStatus !== 'pending')) {
            if (audioRef.current && soundEnabled) {
              audioRef.current.currentTime = 0;
              audioRef.current.play().catch(e => console.log('Audio blocked', e));
            }
          }
          if (newOrder.id) {
            orderStatusesRef.current[newOrder.id] = newOrder.status;
          }
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateStatus = async (id: number, status: string) => {
    setOrders(currentOrders => 
      currentOrders.map(order => 
        order.id === id ? { ...order, status } : order
      ).filter(order => order.status !== 'ready')
    );

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating status:', error);
      fetchOrders();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('staffRole');
    localStorage.removeItem('staffName');
    navigate('/admin/login');
  };

  const enableSound = () => {
    setSoundEnabled(true);
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.log('Audio blocked', e));
    }
  };

  return (
    <div className={`min-h-screen bg-${themeConfig.colors.background}`}>
      <audio ref={audioRef} src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" preload="auto" />
      <header className={`bg-${themeConfig.colors.surface} shadow-sm border-b border-slate-200 sticky top-0 z-10`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ChefHat size={24} className={`text-${themeConfig.colors.primary}`} />
            <h1 className={`text-xl font-bold text-${themeConfig.colors.text}`}>Cozinha - {staffName}</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                const newState = !soundEnabled;
                setSoundEnabled(newState);
                if (newState && audioRef.current) {
                  audioRef.current.currentTime = 0;
                  audioRef.current.play().catch(e => console.log('Audio blocked', e));
                }
              }}
              className={`p-2 rounded-full transition-colors ${soundEnabled ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}
              title={soundEnabled ? "Som ativado" : "Som desativado"}
            >
              {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 text-slate-500 hover:text-red-600 transition-colors font-medium"
            >
              <LogOut size={20} />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orders.map((order) => (
            <div key={order.id} className={`bg-white rounded-2xl shadow-sm border-2 ${order.status === 'preparing' ? 'border-blue-400' : 'border-orange-200'} overflow-hidden flex flex-col`}>
              <div className={`p-4 ${order.status === 'preparing' ? 'bg-blue-50' : 'bg-orange-50'} border-b ${order.status === 'preparing' ? 'border-blue-100' : 'border-orange-100'} flex justify-between items-center`}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl ${order.status === 'preparing' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'} flex flex-col items-center justify-center`}>
                    <span className="text-[10px] font-bold uppercase">Mesa</span>
                    <span className="text-xl font-black leading-none">{order.tableNumber}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">Pedido #{order.id}</h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(order.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${order.status === 'preparing' ? 'bg-blue-200 text-blue-800' : 'bg-orange-200 text-orange-800'}`}>
                  {order.status === 'preparing' ? 'Preparando' : 'Pendente'}
                </span>
              </div>

              <div className="p-4 flex-1 overflow-y-auto">
                <ul className="space-y-3">
                  {order.items?.map((item: any) => (
                    <li key={item.id} className="flex items-start gap-3 border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                      <span className="font-black text-lg text-slate-400 min-w-[24px]">{item.quantity}x</span>
                      <div>
                        <p className="font-bold text-slate-700 text-lg leading-tight">{item.name}</p>
                        {item.notes && (
                          <p className="text-sm text-orange-600 mt-1 bg-orange-50 px-2 py-1 rounded-md inline-block font-medium">
                            Obs: {item.notes}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100">
                {order.status === 'pending' ? (
                  <button 
                    onClick={() => updateStatus(order.id, 'preparing')}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors text-lg shadow-sm"
                  >
                    <ChefHat size={24} /> Iniciar Preparo
                  </button>
                ) : (
                  <button 
                    onClick={() => updateStatus(order.id, 'ready')}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors text-lg shadow-sm"
                  >
                    <Check size={24} /> Marcar como Pronto
                  </button>
                )}
              </div>
            </div>
          ))}

          {orders.length === 0 && (
            <div className="col-span-full py-20 text-center">
              <ChefHat size={64} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-2xl font-bold text-slate-400">Nenhum pedido na fila</h3>
              <p className="text-slate-500 mt-2">A cozinha está tranquila no momento.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
