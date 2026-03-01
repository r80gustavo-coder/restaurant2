import { useEffect, useState } from 'react';
import { themeConfig } from '../../config/theme';
import { Plus, Trash2, Edit2, Tag } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function Categories() {
  const [categories, setCategories] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', icon: 'tag', image: '' });

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  useEffect(() => {
    fetchCategories();

    const channel = supabase
      .channel('admin-categories')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
        fetchCategories();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('categories')
        .insert([formData]);

      if (error) throw error;

      setIsModalOpen(false);
      setFormData({ name: '', icon: 'tag', image: '' });
      // Realtime will update the list
    } catch (error) {
      console.error('Error creating category:', error);
      alert('Erro ao criar categoria. Verifique se a coluna "image" existe no banco de dados.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir esta categoria?')) return;
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      // Realtime will update the list
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Erro ao excluir categoria');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className={`text-2xl font-bold text-${themeConfig.colors.text}`}>Categorias</h2>
        <button 
          onClick={() => setIsModalOpen(true)}
          className={`flex items-center gap-2 px-4 py-2 bg-${themeConfig.colors.primary} text-white rounded-xl hover:bg-${themeConfig.colors.primaryHover} transition-colors font-medium`}
        >
          <Plus size={20} /> Nova Categoria
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {categories.map((cat) => (
          <div 
            key={cat.id} 
            className={`relative overflow-hidden h-40 rounded-2xl shadow-sm border border-slate-200 group`}
          >
            {cat.image ? (
              <img 
                src={cat.image} 
                alt={cat.name} 
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className={`absolute inset-0 bg-${themeConfig.colors.surface} flex items-center justify-center`}>
                <Tag size={48} className={`text-${themeConfig.colors.primary}/20`} />
              </div>
            )}
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">{cat.name}</h3>
                <button 
                  onClick={() => handleDelete(cat.id)}
                  className="p-2 text-white/80 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className={`bg-${themeConfig.colors.surface} rounded-2xl shadow-xl w-full max-w-md overflow-hidden`}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className={`text-xl font-bold text-${themeConfig.colors.text}`}>Nova Categoria</h3>
              <button onClick={() => setIsModalOpen(false)} className={`text-${themeConfig.colors.textMuted} hover:bg-slate-100 p-2 rounded-xl transition-colors`}>
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-semibold text-${themeConfig.colors.text} mb-1.5`}>Nome</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-${themeConfig.colors.primary}/50 focus:border-${themeConfig.colors.primary} transition-all`}
                  placeholder="Ex: Sobremesas"
                />
              </div>

              <div>
                <label className={`block text-sm font-semibold text-${themeConfig.colors.text} mb-1.5`}>URL da Imagem</label>
                <input 
                  type="url" 
                  value={formData.image}
                  onChange={e => setFormData({...formData, image: e.target.value})}
                  className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-${themeConfig.colors.primary}/50 focus:border-${themeConfig.colors.primary} transition-all`}
                  placeholder="https://exemplo.com/imagem.jpg"
                />
                <p className="text-xs text-slate-400 mt-1">Opcional. Use uma URL de imagem válida.</p>
              </div>
              
              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className={`px-6 py-2.5 rounded-xl font-medium text-${themeConfig.colors.textMuted} hover:bg-slate-200 transition-colors`}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className={`px-6 py-2.5 rounded-xl font-medium bg-${themeConfig.colors.primary} text-white hover:bg-${themeConfig.colors.primaryHover} transition-colors`}
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
