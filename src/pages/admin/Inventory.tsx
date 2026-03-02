import { useEffect, useState } from 'react';
import { themeConfig } from '../../config/theme';
import { Plus, Trash2, Edit2, AlertTriangle, Eye, EyeOff, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function Inventory() {
  const [items, setItems] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formData, setFormData] = useState({ name: '', quantity: '', unit: 'un', minQuantity: '', cost: '' });
  const [linkedProducts, setLinkedProducts] = useState<any[]>([]);

  const fetchInventory = async () => {
    try {
      const [invRes, prodRes] = await Promise.all([
        supabase.from('inventory_items').select('*').order('name'),
        supabase.from('products').select('id, name, visible, inventoryItemId').not('inventoryItemId', 'is', null)
      ]);
      
      if (invRes.error) throw invRes.error;
      setItems(invRes.data || []);
      setLinkedProducts(prodRes.data || []);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
  };

  useEffect(() => {
    fetchInventory();

    const channel = supabase
      .channel('admin-inventory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, fetchInventory)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleOpenModal = (item?: any) => {
    if (item) {
      setEditingItem(item);
      setFormData({ 
        name: item.name, 
        quantity: item.currentStock?.toString() || '0', 
        unit: item.unit, 
        minQuantity: item.minStock?.toString() || '5',
        cost: item.cost?.toString() || ''
      });
    } else {
      setEditingItem(null);
      setFormData({ name: '', quantity: '', unit: 'un', minQuantity: '5', cost: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const itemData = {
        name: formData.name,
        currentStock: parseFloat(formData.quantity),
        unit: formData.unit,
        minStock: parseFloat(formData.minQuantity),
        cost: formData.cost ? parseFloat(formData.cost) : 0
      };

      if (editingItem) {
        const { error } = await supabase
          .from('inventory_items')
          .update(itemData)
          .eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('inventory_items')
          .insert([itemData]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      fetchInventory();
    } catch (error) {
      console.error('Error saving inventory item:', error);
      alert('Erro ao salvar item');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) return;
    try {
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchInventory();
    } catch (error: any) {
      console.error('Error deleting item:', error);
      alert('Erro ao excluir item. Verifique se ele não está sendo usado em algum produto.');
    }
  };

  const toggleProductVisibility = async (inventoryItemId: number) => {
    const linkedProduct = linkedProducts.find(p => p.inventoryItemId === inventoryItemId);
    if (!linkedProduct) return;

    try {
      const newVisible = !linkedProduct.visible;
      const { error } = await supabase
        .from('products')
        .update({ visible: newVisible })
        .eq('id', linkedProduct.id);

      if (error) throw error;
      
      // Update local state
      setLinkedProducts(prev => prev.map(p => 
        p.id === linkedProduct.id ? { ...p, visible: newVisible } : p
      ));
    } catch (error) {
      console.error('Error updating visibility:', error);
      alert('Erro ao atualizar visibilidade');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className={`text-2xl font-bold text-${themeConfig.colors.text}`}>Controle de Estoque</h2>
        <button 
          onClick={() => handleOpenModal()}
          className={`flex items-center gap-2 px-4 py-2 bg-${themeConfig.colors.primary} text-white rounded-xl hover:bg-${themeConfig.colors.primaryHover} transition-colors font-medium`}
        >
          <Plus size={20} /> Novo Item
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {items.map((item) => {
          const isLowStock = (item.currentStock || 0) <= (item.minStock || 5);
          const linkedProduct = linkedProducts.find(p => p.inventoryItemId === item.id);

          return (
            <div key={item.id} className={`bg-${themeConfig.colors.surface} p-6 rounded-2xl shadow-sm border ${isLowStock ? 'border-red-200 bg-red-50' : 'border-slate-200'} relative group transition-all hover:shadow-md`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className={`font-bold text-lg text-${themeConfig.colors.text}`}>{item.name}</h3>
                  <p className="text-xs text-slate-500">Mínimo: {item.minStock || 5} {item.unit}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleOpenModal(item)}
                    className="p-2 bg-white text-blue-500 rounded-lg shadow hover:bg-blue-50 transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="p-2 bg-white text-red-500 rounded-lg shadow hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="flex items-end gap-2 mb-4">
                <span className={`text-3xl font-black ${isLowStock ? 'text-red-600' : `text-${themeConfig.colors.primary}`}`}>
                  {item.currentStock}
                </span>
                <span className="text-sm font-bold text-slate-400 mb-1.5">{item.unit}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-slate-600 mb-4 bg-white/50 p-2 rounded-lg">
                <DollarSign size={14} className="text-slate-400" />
                <span>Custo: {themeConfig.currency} {item.cost?.toFixed(2) || '0.00'}</span>
              </div>

              {isLowStock && (
                <div className="flex items-center gap-2 text-red-600 text-xs font-bold bg-red-100 px-3 py-2 rounded-lg mb-3">
                  <AlertTriangle size={14} />
                  <span>Estoque Baixo</span>
                </div>
              )}

              {linkedProduct && (
                <div className="pt-3 border-t border-slate-200/50 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">Visível no Cardápio?</span>
                  <button
                    onClick={() => toggleProductVisibility(item.id)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold transition-colors ${
                      linkedProduct.visible 
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                        : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                    }`}
                    title={linkedProduct.visible ? "Produto visível para clientes" : "Produto oculto"}
                  >
                    {linkedProduct.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    {linkedProduct.visible ? 'Sim' : 'Não'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className={`bg-${themeConfig.colors.surface} rounded-2xl shadow-xl w-full max-w-md overflow-hidden`}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className={`text-xl font-bold text-${themeConfig.colors.text}`}>
                {editingItem ? 'Editar Item' : 'Novo Item'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className={`text-${themeConfig.colors.textMuted} hover:bg-slate-100 p-2 rounded-xl transition-colors`}>
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-semibold text-${themeConfig.colors.text} mb-1.5`}>Nome do Item</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-${themeConfig.colors.primary}/50 focus:border-${themeConfig.colors.primary} transition-all`}
                  placeholder="Ex: Farinha de Trigo"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-semibold text-${themeConfig.colors.text} mb-1.5`}>Quantidade</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    value={formData.quantity}
                    onChange={e => setFormData({...formData, quantity: e.target.value})}
                    className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-${themeConfig.colors.primary}/50 focus:border-${themeConfig.colors.primary} transition-all`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-semibold text-${themeConfig.colors.text} mb-1.5`}>Unidade</label>
                  <select 
                    value={formData.unit}
                    onChange={e => setFormData({...formData, unit: e.target.value})}
                    className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-${themeConfig.colors.primary}/50 focus:border-${themeConfig.colors.primary} transition-all bg-white`}
                  >
                    <option value="un">Unidade (un)</option>
                    <option value="kg">Quilograma (kg)</option>
                    <option value="g">Grama (g)</option>
                    <option value="l">Litro (l)</option>
                    <option value="ml">Mililitro (ml)</option>
                    <option value="fatia">Fatia</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-semibold text-${themeConfig.colors.text} mb-1.5`}>Estoque Mínimo</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={formData.minQuantity}
                    onChange={e => setFormData({...formData, minQuantity: e.target.value})}
                    className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-${themeConfig.colors.primary}/50 focus:border-${themeConfig.colors.primary} transition-all`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-semibold text-${themeConfig.colors.text} mb-1.5`}>Custo Unitário</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={formData.cost}
                    onChange={e => setFormData({...formData, cost: e.target.value})}
                    className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-${themeConfig.colors.primary}/50 focus:border-${themeConfig.colors.primary} transition-all`}
                    placeholder="0.00"
                  />
                </div>
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

