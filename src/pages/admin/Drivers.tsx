import { useState, useEffect } from 'react';
import { themeConfig } from '../../config/theme';
import { Bike, Search, Plus, Edit2, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function Drivers() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    status: 'active'
  });

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error fetching drivers:', error);
    } else {
      setDrivers(data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDriver) {
        const { error } = await supabase
          .from('drivers')
          .update(formData)
          .eq('id', editingDriver.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('drivers')
          .insert([formData]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      fetchDrivers();
    } catch (error) {
      console.error('Error saving driver:', error);
      alert('Erro ao salvar motorista');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este motorista?')) {
      try {
        const { error } = await supabase
          .from('drivers')
          .delete()
          .eq('id', id);
        if (error) throw error;
        fetchDrivers();
      } catch (error) {
        console.error('Error deleting driver:', error);
        alert('Erro ao excluir motorista');
      }
    }
  };

  const openEditModal = (driver: any) => {
    setEditingDriver(driver);
    setFormData({
      name: driver.name,
      phone: driver.phone,
      status: driver.status
    });
    setIsModalOpen(true);
  };

  const openNewModal = () => {
    setEditingDriver(null);
    setFormData({ name: '', phone: '', status: 'active' });
    setIsModalOpen(true);
  };

  const filteredDrivers = drivers.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className={`text-2xl font-bold text-${themeConfig.colors.text}`}>Motoristas</h2>
        <button 
          onClick={openNewModal}
          className={`bg-${themeConfig.colors.primary} text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-emerald-600 transition-colors shadow-sm`}
        >
          <Plus size={20} />
          Novo Motorista
        </button>
      </div>

      <div className={`bg-${themeConfig.colors.surface} p-4 rounded-2xl shadow-sm border border-slate-200`}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Buscar motoristas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDrivers.map((driver) => (
          <div key={driver.id} className={`bg-${themeConfig.colors.surface} p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col`}>
            <div className="flex justify-between items-start mb-4">
              <div className={`w-12 h-12 bg-${themeConfig.colors.primary}/10 rounded-xl flex items-center justify-center text-${themeConfig.colors.primary}`}>
                <Bike size={24} />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => openEditModal(driver)}
                  className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Edit2 size={18} />
                </button>
                <button 
                  onClick={() => handleDelete(driver.id)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            
            <h3 className={`font-bold text-lg text-${themeConfig.colors.text} mb-1`}>{driver.name}</h3>
            <p className="text-slate-500 text-sm mb-4">{driver.phone}</p>
            
            <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-center">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                driver.status === 'active' 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : driver.status === 'pending'
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {driver.status === 'active' ? 'Ativo' : driver.status === 'pending' ? 'Pendente' : 'Inativo'}
              </span>
              {driver.status === 'pending' && (
                <button
                  onClick={async () => {
                    await supabase.from('drivers').update({ status: 'active' }).eq('id', driver.id);
                    fetchDrivers();
                  }}
                  className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Aprovar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">
                {editingDriver ? 'Editar Motorista' : 'Novo Motorista'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Telefone / WhatsApp</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="active">Ativo</option>
                  <option value="pending">Pendente</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-3 bg-${themeConfig.colors.primary} text-white font-bold rounded-xl hover:bg-emerald-600 transition-colors`}
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
