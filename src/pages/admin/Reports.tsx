import React, { useEffect, useState } from 'react';
import { themeConfig } from '../../config/theme';
import { FileText, Filter, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function Reports() {
  const [orders, setOrders] = useState<any[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: '',
    paymentMethod: ''
  });

  const fetchReports = async () => {
    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          table:tables (
            number
          ),
          items:order_items (
            id,
            quantity,
            price,
            notes,
            product:products (
              name
            )
          )
        `)
        .order('createdAt', { ascending: false });

      if (filters.startDate) {
        query = query.gte('createdAt', `${filters.startDate}T00:00:00`);
      }
      if (filters.endDate) {
        query = query.lte('createdAt', `${filters.endDate}T23:59:59`);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.paymentMethod) {
        query = query.eq('paymentMethod', filters.paymentMethod);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedOrders = data?.map(order => ({
        ...order,
        tableNumber: order.table?.number
      })) || [];

      setOrders(formattedOrders);
    } catch (error) {
      console.error('Error fetching reports:', error);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [filters]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const toggleExpand = (orderId: number) => {
    setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
  };

  const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className={`text-2xl font-bold text-${themeConfig.colors.text}`}>Relatórios</h2>
        <button className={`flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition-colors font-medium`}>
          <Download size={20} /> Exportar CSV
        </button>
      </div>

      <div className={`bg-${themeConfig.colors.surface} p-6 rounded-2xl shadow-sm border border-slate-200`}>
        <div className="flex items-center gap-2 mb-4">
          <Filter size={20} className="text-slate-500" />
          <h3 className="font-bold text-slate-700">Filtros</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1.5">Data Inicial</label>
            <input 
              type="date" 
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1.5">Data Final</label>
            <input 
              type="date" 
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1.5">Status</label>
            <select 
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="">Todos</option>
              <option value="pending">Pendente</option>
              <option value="preparing">Preparando</option>
              <option value="ready">Pronto</option>
              <option value="delivered">Entregue</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1.5">Pagamento</label>
            <select 
              name="paymentMethod"
              value={filters.paymentMethod}
              onChange={handleFilterChange}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="">Todos</option>
              <option value="credit">Crédito</option>
              <option value="debit">Débito</option>
              <option value="pix">PIX</option>
              <option value="cash">Dinheiro</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`bg-${themeConfig.colors.surface} p-6 rounded-2xl shadow-sm border border-slate-200`}>
          <p className="text-sm font-medium text-slate-500 mb-1">Total de Pedidos</p>
          <h3 className="text-3xl font-black text-slate-800">{orders.length}</h3>
        </div>
        <div className={`bg-${themeConfig.colors.surface} p-6 rounded-2xl shadow-sm border border-slate-200`}>
          <p className="text-sm font-medium text-slate-500 mb-1">Faturamento Total</p>
          <h3 className="text-3xl font-black text-emerald-600">{themeConfig.currency} {totalRevenue.toFixed(2)}</h3>
        </div>
        <div className={`bg-${themeConfig.colors.surface} p-6 rounded-2xl shadow-sm border border-slate-200`}>
          <p className="text-sm font-medium text-slate-500 mb-1">Ticket Médio</p>
          <h3 className="text-3xl font-black text-blue-600">{themeConfig.currency} {(totalRevenue / (orders.length || 1)).toFixed(2)}</h3>
        </div>
      </div>

      <div className={`bg-${themeConfig.colors.surface} rounded-2xl shadow-sm border border-slate-200 overflow-hidden`}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-4 font-semibold text-slate-600">ID</th>
              <th className="p-4 font-semibold text-slate-600">Data</th>
              <th className="p-4 font-semibold text-slate-600">Mesa</th>
              <th className="p-4 font-semibold text-slate-600">Status</th>
              <th className="p-4 font-semibold text-slate-600">Pagamento</th>
              <th className="p-4 font-semibold text-slate-600 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <React.Fragment key={order.id}>
                <tr 
                  onClick={() => toggleExpand(order.id)}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <td className="p-4 font-medium text-slate-900 flex items-center gap-2">
                    {expandedOrderId === order.id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    #{order.id}
                  </td>
                  <td className="p-4 text-slate-600">{new Date(order.createdAt).toLocaleString()}</td>
                  <td className="p-4 text-slate-600">Mesa {order.tableNumber}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 text-xs font-bold uppercase rounded-md ${
                      order.status === 'delivered' ? 'bg-slate-100 text-slate-600' :
                      order.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                      'bg-emerald-100 text-emerald-600'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="p-4 text-slate-600 uppercase text-sm font-semibold">{order.paymentMethod || '-'}</td>
                  <td className="p-4 text-right font-bold text-slate-900">{themeConfig.currency} {order.total.toFixed(2)}</td>
                </tr>
                {expandedOrderId === order.id && (
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <td colSpan={6} className="p-4">
                      <div className="pl-8">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Itens do Pedido</h4>
                        <div className="space-y-2">
                          {order.items?.map((item: any) => (
                            <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                              <div>
                                <p className="font-semibold text-slate-800 text-sm">
                                  {item.quantity}x {item.product?.name || 'Produto Excluído'}
                                </p>
                                {item.notes && (
                                  <p className="text-xs text-slate-500 mt-0.5">Obs: {item.notes}</p>
                                )}
                              </div>
                              <p className="font-bold text-slate-700 text-sm">
                                {themeConfig.currency} {(item.price * item.quantity).toFixed(2)}
                              </p>
                            </div>
                          ))}
                          {(!order.items || order.items.length === 0) && (
                            <p className="text-sm text-slate-500 italic">Nenhum item encontrado.</p>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">Nenhum pedido encontrado com os filtros atuais.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
