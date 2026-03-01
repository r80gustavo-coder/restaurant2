import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { themeConfig } from '../../config/theme';
import { FileText, Filter, Download } from 'lucide-react';

export default function Reports({ socket }: { socket: Socket | null }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: '',
    paymentMethod: ''
  });

  const fetchReports = async () => {
    const query = new URLSearchParams(filters as any).toString();
    const res = await fetch(`/api/reports?${query}`);
    const data = await res.json();
    setOrders(data);
  };

  useEffect(() => {
    fetchReports();
  }, [filters]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);

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
              <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="p-4 font-medium text-slate-900">#{order.id}</td>
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
