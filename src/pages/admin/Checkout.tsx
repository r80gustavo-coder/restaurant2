import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { themeConfig } from '../../config/theme';
import { DollarSign, Search, CheckCircle2 } from 'lucide-react';

export default function Checkout({ socket }: { socket: Socket | null }) {
  const [tables, setTables] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState('credit');

  const fetchData = async () => {
    const [tablesRes, ordersRes] = await Promise.all([
      fetch('/api/tables'),
      fetch('/api/orders')
    ]);
    const tablesData = await tablesRes.json();
    const ordersData = await ordersRes.json();
    
    setTables(tablesData);
    setOrders(ordersData);
  };

  useEffect(() => {
    fetchData();

    if (socket) {
      socket.on('table_updated', fetchData);
      socket.on('new_order', fetchData);
      socket.on('order_status_updated', fetchData);
      socket.on('orders_paid', fetchData);
    }

    return () => {
      if (socket) {
        socket.off('table_updated');
        socket.off('new_order');
        socket.off('order_status_updated');
        socket.off('orders_paid');
      }
    };
  }, [socket]);

  const handlePay = async () => {
    if (!selectedTable) return;
    
    await fetch('/api/orders/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableId: selectedTable.id,
        paymentMethod
      })
    });
    
    setSelectedTable(null);
  };

  const occupiedTables = tables.filter(t => t.status === 'ocupada');
  const tableOrders = selectedTable 
    ? orders.filter(o => o.tableId === selectedTable.id && o.paymentStatus === 'pending' && o.status !== 'cancelled')
    : [];
    
  const totalToPay = tableOrders.reduce((sum, order) => sum + order.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className={`text-2xl font-bold text-${themeConfig.colors.text}`}>Caixa / Pagamentos</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Mesas Ocupadas */}
        <div className={`bg-${themeConfig.colors.surface} rounded-2xl shadow-sm border border-slate-200 overflow-hidden lg:col-span-1`}>
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h3 className="font-bold text-slate-700">Mesas Ocupadas</h3>
          </div>
          <div className="p-4 space-y-3">
            {occupiedTables.map(table => {
              const tOrders = orders.filter(o => o.tableId === table.id && o.paymentStatus === 'pending' && o.status !== 'cancelled');
              const tTotal = tOrders.reduce((sum, o) => sum + o.total, 0);
              
              return (
                <div 
                  key={table.id}
                  onClick={() => setSelectedTable(table)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedTable?.id === table.id 
                      ? `border-${themeConfig.colors.primary} bg-${themeConfig.colors.primary}/5` 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-lg text-slate-800">Mesa {table.number}</span>
                    <span className="text-sm font-semibold text-orange-600 bg-orange-50 px-2 py-1 rounded-md">
                      {tOrders.length} pedidos
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">Total a pagar:</span>
                    <span className="font-bold text-emerald-600">{themeConfig.currency} {tTotal.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
            
            {occupiedTables.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                Nenhuma mesa ocupada no momento.
              </div>
            )}
          </div>
        </div>

        {/* Detalhes do Pagamento */}
        <div className={`bg-${themeConfig.colors.surface} rounded-2xl shadow-sm border border-slate-200 overflow-hidden lg:col-span-2 flex flex-col`}>
          {selectedTable ? (
            <>
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="text-xl font-bold text-slate-800">Fechamento - Mesa {selectedTable.number}</h3>
                <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold uppercase tracking-wider rounded-full">
                  Aguardando Pagamento
                </span>
              </div>
              
              <div className="p-6 flex-1 overflow-y-auto">
                <h4 className="font-semibold text-slate-700 mb-4">Resumo dos Pedidos</h4>
                <div className="space-y-4">
                  {tableOrders.map(order => (
                    <div key={order.id} className="border border-slate-100 rounded-xl p-4 bg-white">
                      <div className="flex justify-between items-center mb-3 border-b border-slate-50 pb-2">
                        <span className="font-bold text-slate-600 text-sm">Pedido #{order.id}</span>
                        <span className="font-bold text-slate-800">{themeConfig.currency} {order.total.toFixed(2)}</span>
                      </div>
                      <div className="space-y-2">
                        {order.items.map((item: any) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span className="text-slate-600">{item.quantity}x {item.name}</span>
                            <span className="text-slate-500">{themeConfig.currency} {(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  
                  {tableOrders.length === 0 && (
                    <p className="text-slate-500 text-center py-4">Nenhum pedido pendente para esta mesa.</p>
                  )}
                </div>
              </div>
              
              <div className="p-6 border-t border-slate-200 bg-slate-50">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-lg font-semibold text-slate-600">Total a Pagar</span>
                  <span className="text-3xl font-black text-emerald-600">{themeConfig.currency} {totalToPay.toFixed(2)}</span>
                </div>
                
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-slate-700 mb-3">Forma de Pagamento</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { id: 'credit', label: 'Crédito' },
                      { id: 'debit', label: 'Débito' },
                      { id: 'pix', label: 'PIX' },
                      { id: 'cash', label: 'Dinheiro' }
                    ].map(method => (
                      <button
                        key={method.id}
                        onClick={() => setPaymentMethod(method.id)}
                        className={`py-3 px-4 rounded-xl font-semibold text-sm transition-all border ${
                          paymentMethod === method.id 
                            ? `border-${themeConfig.colors.primary} bg-${themeConfig.colors.primary}/10 text-${themeConfig.colors.primary}` 
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {method.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                <button 
                  onClick={handlePay}
                  disabled={totalToPay === 0}
                  className={`w-full py-4 bg-${themeConfig.colors.primary} text-white font-bold text-lg rounded-xl shadow-lg shadow-${themeConfig.colors.primary}/30 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all flex items-center justify-center gap-2`}
                >
                  <CheckCircle2 size={24} /> Confirmar Pagamento e Liberar Mesa
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12">
              <DollarSign size={64} className="mb-4 opacity-20" />
              <p className="text-lg font-medium">Selecione uma mesa para realizar o fechamento</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
