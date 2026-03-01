import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { themeConfig } from '../../config/theme';
import { Users, Copy, Check, Plus, Trash2 } from 'lucide-react';

export default function Tables({ socket }: { socket: Socket | null }) {
  const [tables, setTables] = useState<any[]>([]);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ number: '', loginCode: '' });
  const [error, setError] = useState('');

  const fetchTables = () => {
    fetch('/api/tables')
      .then(res => res.json())
      .then(data => setTables(data));
  };

  useEffect(() => {
    fetchTables();

    if (socket) {
      socket.on('table_added', (table) => {
        setTables(prev => [...prev, table]);
      });
      socket.on('table_updated', (updatedTable) => {
        setTables(prev => prev.map(t => t.id === updatedTable.id ? updatedTable : t));
      });
      socket.on('table_deleted', (id) => {
        setTables(prev => prev.filter(t => t.id !== parseInt(id)));
      });
    }

    return () => {
      if (socket) {
        socket.off('table_added');
        socket.off('table_updated');
        socket.off('table_deleted');
      }
    };
  }, [socket]);

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: parseInt(formData.number),
          loginCode: formData.loginCode.toUpperCase()
        })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao criar mesa');
      }
      
      setIsModalOpen(false);
      setFormData({ number: '', loginCode: '' });
      fetchTables();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir esta mesa?')) return;
    try {
      await fetch(`/api/tables/${id}`, { method: 'DELETE' });
      fetchTables();
    } catch (error) {
      console.error('Error deleting table:', error);
    }
  };

  const toggleStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'livre' ? 'ocupada' : 'livre';
    try {
      await fetch(`/api/tables/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchTables();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className={`text-2xl font-bold text-${themeConfig.colors.text}`}>Mesas e Acessos</h2>
        <button 
          onClick={() => {
            setFormData({ number: '', loginCode: '' });
            setError('');
            setIsModalOpen(true);
          }}
          className={`flex items-center gap-2 px-4 py-2 bg-${themeConfig.colors.primary} text-white rounded-xl hover:bg-${themeConfig.colors.primaryHover} transition-colors font-medium`}
        >
          <Plus size={20} /> Nova Mesa
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {tables.map((table) => (
          <div key={table.id} className={`bg-${themeConfig.colors.surface} p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center text-center transition-transform hover:scale-105 relative group`}>
            <button 
              onClick={() => handleDelete(table.id)}
              className="absolute top-3 right-3 p-2 bg-white text-red-500 rounded-lg shadow hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
            >
              <Trash2 size={16} />
            </button>

            <div className={`w-20 h-20 rounded-full bg-${themeConfig.colors.primary}/10 flex items-center justify-center text-${themeConfig.colors.primary} mb-4`}>
              <Users size={32} />
            </div>
            
            <h3 className={`text-xl font-bold text-${themeConfig.colors.text} mb-1`}>Mesa {table.number}</h3>
            
            <button 
              onClick={() => toggleStatus(table.id, table.status)}
              className={`mb-6 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
                table.status === 'livre' 
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                  : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
              }`}
            >
              {table.status === 'livre' ? 'Livre' : 'Ocupada'}
            </button>
            
            <div className="w-full bg-slate-50 rounded-xl p-4 border border-slate-100 relative group">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Senha da Mesa</p>
              <div className="flex items-center justify-center gap-3">
                <code className={`text-2xl font-mono font-bold text-${themeConfig.colors.primary} tracking-widest`}>
                  {table.loginCode}
                </code>
                <button 
                  onClick={() => copyToClipboard(table.loginCode, table.id)}
                  className={`p-2 rounded-lg transition-colors ${
                    copiedId === table.id 
                      ? 'bg-emerald-100 text-emerald-600' 
                      : 'bg-white text-slate-400 hover:text-slate-600 shadow-sm border border-slate-200'
                  }`}
                  title="Copiar código"
                >
                  {copiedId === table.id ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className={`bg-${themeConfig.colors.surface} rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col`}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className={`text-xl font-bold text-${themeConfig.colors.text}`}>Nova Mesa</h3>
              <button onClick={() => setIsModalOpen(false)} className={`text-${themeConfig.colors.textMuted} hover:bg-slate-100 p-2 rounded-xl transition-colors`}>
                <span className="sr-only">Fechar</span>
                &times;
              </button>
            </div>
            
            <div className="p-6">
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-sm font-medium border border-red-100">
                  {error}
                </div>
              )}
              <form id="table-form" onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={`block text-sm font-semibold text-${themeConfig.colors.text} mb-1.5`}>Número da Mesa</label>
                  <input 
                    type="number" 
                    required
                    min="1"
                    value={formData.number}
                    onChange={e => setFormData({...formData, number: e.target.value})}
                    className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-${themeConfig.colors.primary}/50 focus:border-${themeConfig.colors.primary} transition-all`}
                    placeholder="Ex: 4"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-semibold text-${themeConfig.colors.text} mb-1.5`}>Senha da Mesa</label>
                  <input 
                    type="text" 
                    required
                    value={formData.loginCode}
                    onChange={e => setFormData({...formData, loginCode: e.target.value.toUpperCase()})}
                    className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-${themeConfig.colors.primary}/50 focus:border-${themeConfig.colors.primary} transition-all uppercase`}
                    placeholder="Ex: MESA04"
                  />
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                className={`px-6 py-2.5 rounded-xl font-medium text-${themeConfig.colors.textMuted} hover:bg-slate-200 transition-colors`}
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                form="table-form"
                className={`px-6 py-2.5 rounded-xl font-medium bg-${themeConfig.colors.primary} text-white hover:bg-${themeConfig.colors.primaryHover} transition-colors shadow-sm`}
              >
                Salvar Mesa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
