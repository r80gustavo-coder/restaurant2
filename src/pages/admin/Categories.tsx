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

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedImage = await compressImage(file);
        setFormData({ ...formData, image: compressedImage });
      } catch (error) {
        console.error('Error compressing image:', error);
        alert('Erro ao processar imagem. Tente uma imagem menor.');
      }
    }
  };

  // Utility to compress image
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Compress to JPEG with 0.7 quality
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl);
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const [editingCategory, setEditingCategory] = useState<any | null>(null);

  const handleOpenModal = (category?: any) => {
    if (category) {
      setEditingCategory(category);
      setFormData({ name: category.name, icon: category.icon || 'tag', image: category.image || '' });
    } else {
      setEditingCategory(null);
      setFormData({ name: '', icon: 'tag', image: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update(formData)
          .eq('id', editingCategory.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('categories')
          .insert([formData]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      setFormData({ name: '', icon: 'tag', image: '' });
      setEditingCategory(null);
    } catch (error: any) {
      console.error('Error saving category:', error);
      // Check for payload too large error (413) or string too long
      if (error.message && (error.message.includes('payload') || error.message.includes('too large') || error.code === '22001')) {
         alert('A imagem selecionada é muito grande. Por favor, escolha uma imagem menor (máx 1MB).');
      } else {
         alert('Erro ao salvar categoria: ' + (error.message || 'Erro desconhecido'));
      }
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
          onClick={() => handleOpenModal()}
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
                <div className="flex gap-1">
                  <button 
                    onClick={() => handleOpenModal(cat)}
                    className="p-2 text-white/80 hover:text-blue-400 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(cat.id)}
                    className="p-2 text-white/80 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className={`bg-${themeConfig.colors.surface} rounded-2xl shadow-xl w-full max-w-md overflow-hidden`}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className={`text-xl font-bold text-${themeConfig.colors.text}`}>
                {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
              </h3>
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
                <label className={`block text-sm font-semibold text-${themeConfig.colors.text} mb-1.5`}>Imagem da Categoria</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleImageChange}
                  className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-${themeConfig.colors.primary}/50 focus:border-${themeConfig.colors.primary} transition-all bg-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-${themeConfig.colors.primary}/10 file:text-${themeConfig.colors.primary} hover:file:bg-${themeConfig.colors.primary}/20`}
                />
                {formData.image && (
                  <div className="mt-3 h-32 w-full rounded-xl overflow-hidden border border-slate-200 relative group">
                    <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, image: '' })}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
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
