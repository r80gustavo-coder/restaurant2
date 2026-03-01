import { useEffect, useState } from 'react';
import { themeConfig } from '../../config/theme';
import { Users, Copy, Check, Plus, Trash2, Edit, Power, PowerOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function Tables() {
  const [tables, setTables] = useState<any[]>([]);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<any | null>(null);
  const [formData, setFormData] = useState({ number: '', loginCode: '', active: true });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchTables = async () => {
    const { data, error } = await supabase
      .from('tables')
      .select('*')
      .order('number', { ascending: true });
    
    if (error) {
      console.error('Erro ao buscar mesas:', error);
    } else {
      setTables(data || []);
    }
  };

  useEffect(() => {
    fetchTables();

    // Configurar Realtime do Supabase
    const channel = supabase
      .channel('tables-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tables' },
        (payload) => {
          console.log('Change received!', payload);
          fetchTables();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenModal = (table?: any) => {
    setError('');
    if (table) {
      setEditingTable(table);
      setFormData({ 
        number: table.number.toString(), 
        loginCode: table.loginCode,
        active: table.active !== false // Default to true if undefined
      });
    } else {
      setEditingTable(null);
      setFormData({ number: '', loginCode: '', active: true });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const tableData = {
        number: parseInt(formData.number),
        loginCode: formData.loginCode.toUpperCase(),
        active: formData.active
      };

      if (editingTable) {
        // Atualizar mesa existente
        const { error } = await supabase
          .from('tables')
          .update(tableData)
          .eq('id', editingTable.id);

        if (error) throw error;
      } else {
        // Criar nova mesa
        const { error } = await supabase
          .from('tables')
          .insert([tableData]);

        if (error) throw error;
      }
      
      setIsModalOpen(false);
      fetchTables();
    } catch (err: any) {
      console.error('Erro ao salvar mesa:', err);
      setError(err.message || 'Erro ao salvar mesa. Verifique se o número ou código já existem.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir esta mesa?')) return;
    
    try {
      const { error } = await supabase
        .from('tables')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchTables();
    } catch (error: any) {
      console.error('Error deleting table:', error);
      alert('Erro ao excluir mesa: ' + error.message);
    }
  };

  const toggleStatus = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'livre' ? 'ocupada' : 'livre';
    
    // Optimistic update
    setTables(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));

    try {
      const { error } = await supabase
        .from('tables')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      // O realtime irá atualizar a lista
    } catch (error) {
      console.error('Error updating status:', error);
      // Revert on error
      fetchTables();
    }
  };

  const toggleActive = async (table: any) => {
    const newActive = !table.active;
    
    // Optimistic update
    setTables(prev => prev.map(t => t.id === table.id ? { ...t, active: newActive } : t));

    try {
      const { error } = await supabase
        .from('tables')
        .update({ active: newActive })
        .eq('id', table.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating active status:', error);
      // Revert on error
      fetchTables();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className={`text-2xl font-bold text-${themeConfig.colors.text}`}>Mesas e Acessos</h2>
        <button 
          onClick={() => handleOpenModal()}
          className={`flex items-center gap-2 px-4 py-2 bg-${themeConfig.colors.primary} text-white rounded-xl hover:bg-${themeConfig.colors.primaryHover} transition-colors font-medium shadow-sm`}
        >
          <Plus size={20} /> Nova Mesa
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {tables.map((table) => (
          <div 
            key={table.id} 
            className={`bg-${themeConfig.colors.surface} p-6 rounded-2xl shadow-sm border ${table.active ? 'border-slate-200' : 'border-slate-100 bg-slate-50 opacity-75'} flex flex-col items-center text-center transition-all hover:shadow-md relative group`}
          >
            <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => handleOpenModal(table)}
                className="p-2 bg-white text-blue-500 rounded-lg shadow hover:bg-blue-50 transition-colors"
                title="Editar"
              >
                <Edit size={16} />
              </button>
              <button 
                onClick={() => handleDelete(table.id)}
                className="p-2 bg-white text-red-500 rounded-lg shadow hover:bg-red-50 transition-colors"
                title="Excluir"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="absolute top-3 left-3">
               <button 
                onClick={() => toggleActive(table)}
                className={`p-1.5 rounded-lg transition-colors ${table.active ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-200'}`}
                title={table.active ? "Desativar Mesa" : "Ativar Mesa"}
              >
                {table.active ? <Power size={18} /> : <PowerOff size={18} />}
              </button>
            </div>

            <div className={`w-20 h-20 rounded-full ${table.active ? `bg-${themeConfig.colors.primary}/10 text-${themeConfig.colors.primary}` : 'bg-slate-200 text-slate-400'} flex items-center justify-center mb-4 transition-colors`}>
              <Users size={32} />
            </div>
            
            <h3 className={`text-xl font-bold text-${themeConfig.colors.text} mb-1`}>
              Mesa {table.number}
              {!table.active && <span className="text-xs font-normal text-slate-400 ml-2">(Inativa)</span>}
            </h3>
            
            <button 
              onClick={() => table.active && toggleStatus(table.id, table.status)}
              disabled={!table.active}
              className={`mb-6 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
                !table.active 
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : table.status === 'livre' 
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                    : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
              }`}
            >
              {table.status === 'livre' ? 'Livre' : 'Ocupada'}
            </button>
            
            <div className="w-full bg-slate-50 rounded-xl p-4 border border-slate-100 relative group">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Senha da Mesa</p>
              <div className="flex items-center justify-center gap-3">
                <code className={`text-2xl font-mono font-bold ${table.active ? `text-${themeConfig.colors.primary}` : 'text-slate-400'} tracking-widest`}>
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
          <div className={`bg-${themeConfig.colors.surface} rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200`}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className={`text-xl font-bold text-${themeConfig.colors.text}`}>
                {editingTable ? 'Editar Mesa' : 'Nova Mesa'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className={`text-${themeConfig.colors.textMuted} hover:bg-slate-100 p-2 rounded-xl transition-colors`}>
                <span className="sr-only">Fechar</span>
                &times;
              </button>
            </div>
            
            <div className="p-6">
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-sm font-medium border border-red-100 flex items-center gap-2">
                  <span className="block w-1 h-4 bg-red-500 rounded-full"></span>
                  {error}
                </div>
              )}
              <form id="table-form" onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className={`block text-sm font-semibold text-${themeConfig.colors.text} mb-1.5`}>Número da Mesa</label>
                  <input 
                    type="number" 
                    required
                    min="1"
                    value={formData.number}
                    onChange={e => setFormData({...formData, number: e.target.value})}
                    className={`w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-${themeConfig.colors.primary}/50 focus:border-${themeConfig.colors.primary} transition-all bg-slate-50 focus:bg-white`}
                    placeholder="Ex: 4"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-semibold text-${themeConfig.colors.text} mb-1.5`}>Senha de Acesso</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      required
                      value={formData.loginCode}
                      onChange={e => setFormData({...formData, loginCode: e.target.value.toUpperCase()})}
                      className={`w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-${themeConfig.colors.primary}/50 focus:border-${themeConfig.colors.primary} transition-all uppercase bg-slate-50 focus:bg-white font-mono tracking-wider`}
                      placeholder="Ex: MESA04"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, loginCode: Math.random().toString(36).substring(2, 8).toUpperCase()})}
                      className="absolute right-2 top-2 p-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      Gerar
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Esta senha será usada pelo cliente para acessar o cardápio.</p>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className={`p-2 rounded-lg ${formData.active ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                    {formData.active ? <Power size={20} /> : <PowerOff size={20} />}
                  </div>
                  <div className="flex-1">
                    <span className="block text-sm font-semibold text-slate-700">Status da Mesa</span>
                    <span className="block text-xs text-slate-500">{formData.active ? 'Mesa Ativa e visível' : 'Mesa Inativa (oculta)'}</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={formData.active}
                      onChange={e => setFormData({...formData, active: e.target.checked})}
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
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
                disabled={loading}
                className={`px-6 py-2.5 rounded-xl font-medium bg-${themeConfig.colors.primary} text-white hover:bg-${themeConfig.colors.primaryHover} transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2`}
              >
                {loading ? 'Salvando...' : (editingTable ? 'Salvar Alterações' : 'Criar Mesa')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
