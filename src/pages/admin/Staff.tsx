import { useState, useEffect } from 'react';
import { themeConfig } from '../../config/theme';
import { Plus, Edit2, Trash2, Search, User, ChefHat, UserCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function Staff() {
  const [staff, setStaff] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [search, setSearch] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: 'waiter'
  });

  const fetchStaff = async () => {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error fetching staff:', error);
    } else {
      setStaff(data || []);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingStaff) {
        const { error } = await supabase
          .from('staff')
          .update({
            name: formData.name,
            username: formData.username,
            password: formData.password,
            role: formData.role
          })
          .eq('id', editingStaff.id);
          
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('staff')
          .insert([formData]);
          
        if (error) throw error;
      }
      
      setIsAdding(false);
      setEditingStaff(null);
      setFormData({ name: '', username: '', password: '', role: 'waiter' });
      fetchStaff();
    } catch (error: any) {
      console.error('Error saving staff:', error);
      alert('Erro ao salvar funcionário. O nome de usuário pode já existir.');
    }
  };

  const handleEdit = (staffMember: any) => {
    setEditingStaff(staffMember);
    setFormData({
      name: staffMember.name,
      username: staffMember.username,
      password: staffMember.password,
      role: staffMember.role
    });
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este funcionário?')) {
      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', id);
        
      if (error) {
        console.error('Error deleting staff:', error);
        alert('Erro ao excluir funcionário');
      } else {
        fetchStaff();
      }
    }
  };

  const filteredStaff = staff.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.username.toLowerCase().includes(search.toLowerCase())
  );

  const getRoleIcon = (role: string) => {
    switch(role) {
      case 'admin': return <UserCircle size={20} className="text-purple-500" />;
      case 'cook': return <ChefHat size={20} className="text-orange-500" />;
      case 'waiter': return <User size={20} className="text-blue-500" />;
      default: return <User size={20} />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch(role) {
      case 'admin': return 'Administrador';
      case 'cook': return 'Cozinheiro';
      case 'waiter': return 'Garçom';
      default: return role;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className={`text-2xl font-bold text-${themeConfig.colors.text}`}>Equipe</h2>
        <button 
          onClick={() => {
            setIsAdding(true);
            setEditingStaff(null);
            setFormData({ name: '', username: '', password: '', role: 'waiter' });
          }}
          className={`bg-${themeConfig.colors.primary} text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-${themeConfig.colors.primaryHover} transition-colors font-medium shadow-sm hover:shadow`}
        >
          <Plus size={20} />
          Novo Funcionário
        </button>
      </div>

      {isAdding && (
        <div className={`bg-${themeConfig.colors.surface} p-6 rounded-2xl shadow-sm border border-slate-200 animate-in fade-in slide-in-from-top-4`}>
          <h3 className={`text-lg font-bold text-${themeConfig.colors.text} mb-4`}>
            {editingStaff ? 'Editar Funcionário' : 'Novo Funcionário'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Ex: João Silva"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Usuário</label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={e => setFormData({...formData, username: e.target.value})}
                  className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Ex: joao.silva"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
                <input
                  type="text"
                  required
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Senha de acesso"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cargo</label>
                <select
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value})}
                  className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white"
                >
                  <option value="waiter">Garçom</option>
                  <option value="cook">Cozinheiro</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`px-6 py-2.5 rounded-xl bg-${themeConfig.colors.primary} text-white font-medium hover:bg-${themeConfig.colors.primaryHover} transition-colors shadow-sm`}
              >
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className={`bg-${themeConfig.colors.surface} rounded-2xl shadow-sm border border-slate-200 overflow-hidden`}>
        <div className="p-4 border-b border-slate-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Buscar funcionários..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 bg-slate-50 focus:bg-white transition-colors"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="p-4 font-semibold text-slate-600 text-sm">Nome</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Usuário</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Cargo</th>
                <th className="p-4 font-semibold text-slate-600 text-sm text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map((s) => (
                <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="p-4">
                    <div className="font-medium text-slate-900">{s.name}</div>
                  </td>
                  <td className="p-4 text-slate-600">{s.username}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {getRoleIcon(s.role)}
                      <span className="font-medium text-slate-700">{getRoleLabel(s.role)}</span>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleEdit(s)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(s.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir"
                        disabled={s.username === 'admin'}
                      >
                        <Trash2 size={18} className={s.username === 'admin' ? 'opacity-50' : ''} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredStaff.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400">
                    Nenhum funcionário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
