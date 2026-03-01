import { useEffect, useState } from 'react';
import { themeConfig } from '../../config/theme';
import { Plus, Trash2, Edit2, Package, ArrowDownToLine } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function Inventory() {
  const [items, setItems] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', unit: 'un', currentStock: 0, minStock: 0 });
  const [addQuantity, setAddQuantity] = useState(0);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
  };

  useEffect(() => {
    fetchItems();
    
    const channel = supabase
      .channel('admin-inventory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, () => {
        fetchItems();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedItem) {
        // Update
        const { error } = await supabase
          .from('inventory_items')
          .update(formData)
          .eq('id', selectedItem.id);
        if (error) throw error;
      } else {
        // Create
        const { error } = await supabase
          .from('inventory_items')
          .insert([formData]);
        if (error) throw error;
      }
      
      setIsModalOpen(false);
      setSelectedItem(null);
      setFormData({ name: '', unit: 'un', currentStock: 0, minStock: 0 });
      // Realtime will update the list
    } catch (error) {
      console.error('Error saving inventory item:', error);
      alert('Erro ao salvar item');
    }
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    
    try {
      // Fetch current stock first to ensure consistency (optional but good practice)
      // For simplicity, we'll just increment using the current known value + addQuantity
      // Or better, use a stored procedure or just update with current + new
      
      // Since Supabase doesn't have an atomic increment easily without RPC, we'll read then write
      const { data: currentItem, error: fetchError } = await supabase
        .from('inventory_items')
        .select('currentStock')
        .eq('id', selectedItem.id)
        .single();
        
      if (fetchError) throw fetchError;

      const newStock = (currentItem.currentStock || 0) + addQuantity;

      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({ currentStock: newStock })
        .eq('id', selectedItem.id);

      if (updateError) throw updateError;
      
      setIsAddStockOpen(false);
      setSelectedItem(null);
      setAddQuantity(0);
      // Realtime will update the list
    } catch (error) {
      console.error('Error adding stock:', error);
      alert('Erro ao adicionar estoque');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este item do estoque?')) return;
    try {
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      alert('Erro ao excluir item. Verifique se ele não está vinculado a algum produto.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className={`text-2xl font-bold text-${themeConfig.colors.text}`}>Estoque</h2>
        <button 
          onClick={() => {
            setSelectedItem(null);
            setFormData({ name: '', unit: 'un', currentStock: 0, minStock: 0 });
            setIsModalOpen(true);
          }}
          className={`flex items-center gap-2 px-4 py-2 bg-${themeConfig.colors.primary} text-white rounded-xl hover:bg-${themeConfig.colors.primaryHover} transition-colors font-medium`}
        >
          <Plus size={20} /> Novo Item
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-4 font-semibold text-slate-600">Item</th>
              <th className="p-4 font-semibold text-slate-600">Unidade</th>
              <th className="p-4 font-semibold text-slate-600 text-right">Estoque Atual</th>
              <th className="p-4 font-semibold text-slate-600 text-right">Estoque Mínimo</th>
              <th className="p-4 font-semibold text-slate-600 text-center">Status</th>
              <th className="p-4 font-semibold text-slate-600 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="p-4 font-medium text-slate-900 flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-${themeConfig.colors.primary}/10 text-${themeConfig.colors.primary}`}>
                    <Package size={18} />
                  </div>
                  {item.name}
                </td>
                <td className="p-4 text-slate-600">{item.unit}</td>
                <td className="p-4 text-right font-bold text-slate-900">{item.currentStock}</td>
                <td className="p-4 text-right text-slate-600">{item.minStock}</td>
                <td className="p-4 text-center">
                  {item.currentStock <= item.minStock ? (
                    <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold uppercase tracking-wider rounded-full">Baixo</span>
                  ) : (
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wider rounded-full">Normal</span>
                  )}
                </td>
                <td className="p-4 text-right space-x-2">
                  <button 
                    onClick={() => {
                      setSelectedItem(item);
                      setAddQuantity(0);
                      setIsAddStockOpen(true);
                    }}
                    className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    title="Dar Entrada"
                  >
                    <ArrowDownToLine size={18} />
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedItem(item);
                      setFormData({ name: item.name, unit: item.unit, currentStock: item.currentStock, minStock: item.minStock });
                      setIsModalOpen(true);
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Novo/Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className={`bg-${themeConfig.colors.surface} rounded-2xl shadow-xl w-full max-w-md overflow-hidden`}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className={`text-xl font-bold text-${themeConfig.colors.text}`}>{selectedItem ? 'Editar Item' : 'Novo Item'}</h3>
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
                  placeholder="Ex: Pão de Hambúrguer"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
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
                <div>
                  <label className={`block text-sm font-semibold text-${themeConfig.colors.text} mb-1.5`}>Estoque Mínimo</label>
                  <input 
                    type="number" 
                    required
                    min="0"
                    step="0.01"
                    value={formData.minStock}
                    onChange={e => setFormData({...formData, minStock: parseFloat(e.target.value)})}
                    className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-${themeConfig.colors.primary}/50 focus:border-${themeConfig.colors.primary} transition-all`}
                  />
                </div>
              </div>

              {!selectedItem && (
                <div>
                  <label className={`block text-sm font-semibold text-${themeConfig.colors.text} mb-1.5`}>Estoque Inicial</label>
                  <input 
                    type="number" 
                    required
                    min="0"
                    step="0.01"
                    value={formData.currentStock}
                    onChange={e => setFormData({...formData, currentStock: parseFloat(e.target.value)})}
                    className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-${themeConfig.colors.primary}/50 focus:border-${themeConfig.colors.primary} transition-all`}
                  />
                </div>
              )}
              
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

      {/* Modal Dar Entrada */}
      {isAddStockOpen && selectedItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className={`bg-${themeConfig.colors.surface} rounded-2xl shadow-xl w-full max-w-sm overflow-hidden`}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className={`text-xl font-bold text-${themeConfig.colors.text}`}>Dar Entrada</h3>
              <button onClick={() => setIsAddStockOpen(false)} className={`text-${themeConfig.colors.textMuted} hover:bg-slate-100 p-2 rounded-xl transition-colors`}>
                &times;
              </button>
            </div>
            
            <form onSubmit={handleAddStock} className="p-6 space-y-4">
              <div>
                <p className="text-sm text-slate-500 mb-4">
                  Adicionando estoque para: <strong className="text-slate-900">{selectedItem.name}</strong>
                </p>
                <label className={`block text-sm font-semibold text-${themeConfig.colors.text} mb-1.5`}>Quantidade ({selectedItem.unit})</label>
                <input 
                  type="number" 
                  required
                  min="0.01"
                  step="0.01"
                  value={addQuantity}
                  onChange={e => setAddQuantity(parseFloat(e.target.value))}
                  className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-${themeConfig.colors.primary}/50 focus:border-${themeConfig.colors.primary} transition-all`}
                  placeholder="Ex: 50"
                />
              </div>
              
              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsAddStockOpen(false)}
                  className={`px-6 py-2.5 rounded-xl font-medium text-${themeConfig.colors.textMuted} hover:bg-slate-200 transition-colors`}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className={`px-6 py-2.5 rounded-xl font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors`}
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
