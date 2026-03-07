import { useEffect, useState, useRef } from 'react';
import { themeConfig } from '../../config/theme';
import { Check, Clock, User, LogOut, BellRing, Volume2, VolumeX } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function Waiter() {
  const [orders, setOrders] = useState<any[]>([]);
  const [tablesCalling, setTablesCalling] = useState<number[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const soundEnabledRef = useRef(false);
  const navigate = useNavigate();
  const staffName = localStorage.getItem('staffName') || 'Garçom';
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const orderStatusesRef = useRef<Record<number, string>>({});
  const tableNeedsWaiterRef = useRef<Record<number, boolean>>({});

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
        .in('status', ['ready', 'preparing'])
        .order('createdAt', { ascending: false });

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

  const fetchTablesCalling = async () => {
    try {
      const { data, error } = await supabase
        .from('tables')
        .select('id, number')
        .eq('needs_waiter', true);

      if (error) throw error;
      setTablesCalling(data?.map(t => t.number) || []);
      
      if (data) {
        const needs: Record<number, boolean> = {};
        data.forEach(t => needs[t.id] = true);
        tableNeedsWaiterRef.current = needs;
      }
    } catch (error) {
      console.error('Error fetching tables calling:', error);
    }
  };

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    fetchOrders();
    fetchTablesCalling();

    const channelOrders = supabase
      .channel('waiter-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          const newOrder = payload.new as any;
          const oldStatus = (payload.old as any)?.status || orderStatusesRef.current[newOrder.id];
          
          if (payload.eventType === 'UPDATE' && newOrder.status === 'ready' && oldStatus !== 'ready') {
            if (audioRef.current && soundEnabledRef.current) {
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

    const channelTables = supabase
      .channel('waiter-tables')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tables' },
        (payload) => {
          const newTable = payload.new as any;
          const prevNeeds = (payload.old as any)?.needs_waiter ?? tableNeedsWaiterRef.current[newTable.id];
          
          if (newTable.needs_waiter && !prevNeeds) {
            if (audioRef.current && soundEnabledRef.current) {
              audioRef.current.currentTime = 0;
              audioRef.current.play().catch(e => console.log('Audio blocked', e));
            }
          }
          if (newTable.id) {
            tableNeedsWaiterRef.current[newTable.id] = newTable.needs_waiter;
          }
          fetchTablesCalling();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelOrders);
      supabase.removeChannel(channelTables);
    };
  }, []);

  const updateStatus = async (id: number, status: string) => {
    setOrders(currentOrders => 
      currentOrders.map(order => 
        order.id === id ? { ...order, status } : order
      ).filter(order => order.status !== 'delivered')
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

  const answerCall = async (tableNumber: number) => {
    try {
      const { error } = await supabase
        .from('tables')
        .update({ needs_waiter: false })
        .eq('number', tableNumber);

      if (error) throw error;
      fetchTablesCalling();
    } catch (error) {
      console.error('Error answering call:', error);
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
            <User size={24} className={`text-${themeConfig.colors.primary}`} />
            <h1 className={`text-xl font-bold text-${themeConfig.colors.text}`}>Garçom - {staffName}</h1>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Chamados de Mesa */}
        {tablesCalling.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <BellRing className="text-red-500 animate-pulse" /> Mesas Chamando
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {tablesCalling.map(tableNumber => (
                <div key={tableNumber} className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-sm">
                  <span className="text-sm font-bold text-red-600 uppercase tracking-wider mb-1">Mesa</span>
                  <span className="text-4xl font-black text-red-700 mb-4">{tableNumber}</span>
                  <button 
                    onClick={() => answerCall(tableNumber)}
                    className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors shadow-sm"
                  >
                    Atender
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Pedidos Prontos para Entrega */}
        <section>
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Check className="text-emerald-500" /> Prontos para Entrega
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders.filter(o => o.status === 'ready').map((order) => (
              <div key={order.id} className="bg-white rounded-2xl shadow-sm border-2 border-emerald-400 overflow-hidden flex flex-col">
                <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex flex-col items-center justify-center">
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
                  <span className="px-2 py-1 rounded text-xs font-bold uppercase bg-emerald-200 text-emerald-800">
                    Pronto
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
                  <button 
                    onClick={() => updateStatus(order.id, 'delivered')}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors text-lg shadow-sm"
                  >
                    <Check size={24} /> Marcar como Entregue
                  </button>
                </div>
              </div>
            ))}

            {orders.filter(o => o.status === 'ready').length === 0 && (
              <div className="col-span-full py-12 text-center bg-slate-50 rounded-2xl border border-slate-200 border-dashed">
                <Check size={48} className="mx-auto text-slate-300 mb-4" />
                <h3 className="text-xl font-bold text-slate-400">Nenhum pedido pronto</h3>
                <p className="text-slate-500 mt-2">Aguarde a cozinha finalizar os pedidos.</p>
              </div>
            )}
          </div>
        </section>

        {/* Pedidos Preparando */}
        <section>
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2 opacity-60">
            <Clock className="text-blue-500" /> Em Preparo
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-60">
            {orders.filter(o => o.status === 'preparing').map((order) => (
              <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-600 flex flex-col items-center justify-center">
                      <span className="text-[8px] font-bold uppercase">Mesa</span>
                      <span className="text-lg font-black leading-none">{order.tableNumber}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-700">Pedido #{order.id}</h3>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded text-xs font-bold uppercase bg-blue-100 text-blue-700">
                    Preparando
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}
