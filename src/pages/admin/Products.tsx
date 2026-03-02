import { useEffect, useState } from 'react';
import { themeConfig } from '../../config/theme';
import { Plus, Trash2, Edit2, Image as ImageIcon, PlusCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function Products() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    categoryId: '',
    image: '',
    type: 'composed',
    visible: true,
    inventoryItemId: '',
    ingredients: [] as { inventoryItemId: string, quantity: string }[]
  });

  const fetchData = async () => {
    try {
      const [prodRes, catRes, invRes] = await Promise.all([
        supabase.from('products').select(`
          *,
          ingredients:product_ingredients (
            id,
            inventoryItemId,
            quantity,
            inventory_item:inventory_items (
              name,
              unit
            )
          )
        `).order('name'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('inventory_items').select('*').order('name')
      ]);

      if (prodRes.error) throw prodRes.error;
      if (catRes.error) throw catRes.error;
      if (invRes.error) throw invRes.error;
      
      // Transform products to include flattened ingredients for easier UI handling
      const formattedProducts = prodRes.data?.map(p => ({
        ...p,
        ingredients: p.ingredients?.map((i: any) => ({
          ...i,
          name: i.inventory_item?.name,
          unit: i.inventory_item?.unit
        }))
      })) || [];

      setProducts(formattedProducts);
      setCategories(catRes.data || []);
      setInventoryItems(invRes.data || []);
      
      if (catRes.data && catRes.data.length > 0 && !formData.categoryId) {
        setFormData(prev => ({ ...prev, categoryId: catRes.data[0].id.toString() }));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    fetchData();

    const productsChannel = supabase
      .channel('admin-products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchData)
      .subscribe();

    const categoriesChannel = supabase
      .channel('admin-products-categories')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, fetchData)
      .subscribe();

    const inventoryChannel = supabase
      .channel('admin-products-inventory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(categoriesChannel);
      supabase.removeChannel(inventoryChannel);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const productData = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price as string),
        categoryId: parseInt(formData.categoryId),
        image: formData.image,
        type: formData.type,
        visible: formData.visible,
        inventoryItemId: formData.type === 'fixed' ? parseInt(formData.inventoryItemId) : null
      };

      let productId = editingId;

      if (editingId) {
        // Update Product
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingId);
        if (error) throw error;

        // Delete existing ingredients
        await supabase.from('product_ingredients').delete().eq('productId', editingId);
      } else {
        // Create Product
        const { data, error } = await supabase
          .from('products')
          .insert([productData])
          .select()
          .single();
        if (error) throw error;
        productId = data.id;
      }

      // Insert Ingredients if composed
      if (formData.type === 'composed' && formData.ingredients.length > 0 && productId) {
        const ingredientsToInsert = formData.ingredients.map(i => ({
          productId: productId,
          inventoryItemId: parseInt(i.inventoryItemId),
          quantity: parseFloat(i.quantity)
        }));
        
        const { error: ingError } = await supabase
          .from('product_ingredients')
          .insert(ingredientsToInsert);
        
        if (ingError) throw ingError;
      }

      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ 
        name: '', description: '', price: '', 
        categoryId: categories[0]?.id.toString() || '', 
        image: '', type: 'composed', visible: true, inventoryItemId: '', ingredients: [] 
      });
      fetchData();
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Erro ao salvar produto');
    }
  };

  const handleEdit = (product: any) => {
    setEditingId(product.id);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      categoryId: product.categoryId?.toString() || (categories[0]?.id.toString() || ''),
      image: product.image || '',
      type: product.type || 'composed',
      visible: product.visible !== false,
      inventoryItemId: product.inventoryItemId?.toString() || '',
      ingredients: product.ingredients ? product.ingredients.map((i: any) => ({
        inventoryItemId: i.inventoryItemId.toString(),
        quantity: i.quantity.toString()
      })) : []
    });
    setIsModalOpen(true);
  };

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

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;
    try {
      // Delete ingredients first (cascade usually handles this, but explicit is safer if not configured)
      await supabase.from('product_ingredients').delete().eq('productId', id);
      
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) {
        // Check for foreign key constraint error (e.g., linked to orders)
        if (error.code === '23503') {
          alert('Não é possível excluir este produto pois ele já faz parte de pedidos realizados. Sugerimos ocultá-lo (torná-lo invisível) em vez de excluir.');
          return;
        }
        throw error;
      }
      fetchData();
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Erro ao excluir produto');
    }
  };

  const addIngredient = () => {
    if (inventoryItems.length === 0) return;
    setFormData({
      ...formData,
      ingredients: [...formData.ingredients, { inventoryItemId: inventoryItems[0].id.toString(), quantity: '1' }]
    });
  };

  const updateIngredient = (index: number, field: string, value: string) => {
    const newIngredients = [...formData.ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setFormData({ ...formData, ingredients: newIngredients });
  };

  const removeIngredient = (index: number) => {
    const newIngredients = [...formData.ingredients];
    newIngredients.splice(index, 1);
    setFormData({ ...formData, ingredients: newIngredients });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className={`text-2xl font-bold text-${themeConfig.colors.text}`}>Produtos</h2>
        <button 
          onClick={() => {
            setEditingId(null);
            setFormData({ 
              name: '', description: '', price: '', 
              categoryId: categories[0]?.id.toString() || '', 
              image: '', type: 'composed', visible: true, inventoryItemId: '', ingredients: [] 
            });
            setIsModalOpen(true);
          }}
          className={`flex items-center gap-2 px-4 py-2 bg-${themeConfig.colors.primary} text-white rounded-xl hover:bg-${themeConfig.colors.primaryHover} transition-colors font-medium`}
        >
          <Plus size={20} /> Novo Produto
        </button>
      </div>

      <div className="space-y-8">
        {categories.map(category => {
          const categoryProducts = products.filter(p => p.categoryId === category.id);
          if (categoryProducts.length === 0) return null;

          return (
            <div key={category.id}>
              <h3 className={`text-xl font-bold text-${themeConfig.colors.text} mb-4 flex items-center gap-2`}>
                {category.name}
                <span className="text-sm font-normal text-slate-400">({categoryProducts.length})</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {categoryProducts.map((product) => (
                  <div key={product.id} className={`bg-${themeConfig.colors.surface} rounded-2xl shadow-sm border border-slate-200 overflow-hidden group ${!product.visible ? 'opacity-75' : ''}`}>
                    <div className="h-48 bg-slate-100 relative overflow-hidden">
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <ImageIcon size={48} />
                        </div>
                      )}
                      
                      {!product.visible && (
                        <div className="absolute inset-0 bg-black/10 flex items-center justify-center backdrop-blur-[1px]">
                          <span className="bg-slate-800 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Oculto</span>
                        </div>
                      )}

                      <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleEdit(product)}
                          className="p-2 bg-white text-blue-500 rounded-lg shadow hover:bg-blue-50 transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(product.id)}
                          className="p-2 bg-white text-red-500 rounded-lg shadow hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className={`font-bold text-lg text-${themeConfig.colors.text} leading-tight`}>{product.name}</h3>
                        <span className={`font-bold text-${themeConfig.colors.primary} whitespace-nowrap ml-3`}>
                          {themeConfig.currency} {product.price.toFixed(2)}
                        </span>
                      </div>
                      <p className={`text-sm text-${themeConfig.colors.textMuted} line-clamp-2 mb-3`}>{product.description}</p>
                      
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <p className={`text-xs font-semibold text-${themeConfig.colors.text} uppercase tracking-wider mb-2`}>Ficha Técnica ({product.type === 'fixed' ? 'Fixo' : 'Composto'})</p>
                        {product.type === 'fixed' ? (
                          <p className="text-xs text-slate-500">
                            Estoque: {inventoryItems.find(i => i.id === product.inventoryItemId)?.name || 'Não vinculado'}
                          </p>
                        ) : (
                          <ul className="text-xs text-slate-500 space-y-1">
                            {product.ingredients?.map((ing: any) => (
                              <li key={ing.id}>• {ing.quantity} {ing.unit} {ing.name}</li>
                            ))}
                            {(!product.ingredients || product.ingredients.length === 0) && (
                              <li>Nenhum ingrediente cadastrado</li>
                            )}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        
        {products.length === 0 && (
           <div className="text-center py-12">
             <p className="text-slate-500">Nenhum produto cadastrado.</p>
           </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className={`bg-${themeConfig.colors.surface} rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]`}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className={`text-xl font-bold text-${themeConfig.colors.text}`}>
                {editingId ? 'Editar Produto' : 'Novo Produto'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className={`text-${themeConfig.colors.textMuted} hover:bg-slate-100 p-2 rounded-xl transition-colors`}>
                &times;
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <form id="product-form" onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-5">
                  <div className="col-span-2 md:col-span-1">
                    <label className={`block text-sm font-semibold text-${themeConfig.colors.text} mb-1.5`}>Nome</label>
                    <input 
                      type="text" 
                      required
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-${themeConfig.colors.primary}/50 focus:border-${themeConfig.colors.primary} transition-all`}
                    />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className={`block text-sm font-semibold text-${themeConfig.colors.text} mb-1.5`}>Preço ({themeConfig.currency})</label>
                    <input 
                      type="number" 
                      step="0.01"
                      required
                      value={formData.price}
                      onChange={e => setFormData({...formData, price: e.target.value})}
                      className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-${themeConfig.colors.primary}/50 focus:border-${themeConfig.colors.primary} transition-all`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="col-span-2 md:col-span-1">
                    <label className={`block text-sm font-semibold text-${themeConfig.colors.text} mb-1.5`}>Categoria</label>
                    <select 
                      value={formData.categoryId}
                      onChange={e => setFormData({...formData, categoryId: e.target.value})}
                      className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-${themeConfig.colors.primary}/50 focus:border-${themeConfig.colors.primary} transition-all bg-white`}
                      required
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className={`block text-sm font-semibold text-${themeConfig.colors.text} mb-1.5`}>Imagem do Produto</label>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleImageChange}
                      className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-${themeConfig.colors.primary}/50 focus:border-${themeConfig.colors.primary} transition-all bg-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-${themeConfig.colors.primary}/10 file:text-${themeConfig.colors.primary} hover:file:bg-${themeConfig.colors.primary}/20`}
                    />
                    {formData.image && (
                      <div className="mt-2 h-20 w-20 rounded-lg overflow-hidden border border-slate-200">
                        <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className={`block text-sm font-semibold text-${themeConfig.colors.text} mb-1.5`}>Descrição Curta</label>
                  <textarea 
                    rows={2}
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-${themeConfig.colors.primary}/50 focus:border-${themeConfig.colors.primary} transition-all resize-none`}
                  />
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex-1">
                    <span className="block text-sm font-semibold text-slate-700">Visibilidade</span>
                    <span className="block text-xs text-slate-500">
                      {formData.visible ? 'Visível no cardápio do cliente' : 'Oculto (apenas uso interno)'}
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={formData.visible}
                      onChange={e => setFormData({...formData, visible: e.target.checked})}
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                <div className="border-t border-slate-200 pt-5">
                  <h4 className="font-bold text-slate-800 mb-4">Ficha Técnica e Estoque</h4>
                  
                  <div className="mb-4">
                    <label className="flex items-center gap-4">
                      <span className="text-sm font-semibold text-slate-700">Tipo de Produto:</span>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="type" 
                            value="fixed" 
                            checked={formData.type === 'fixed'}
                            onChange={() => setFormData({...formData, type: 'fixed'})}
                            className={`text-${themeConfig.colors.primary} focus:ring-${themeConfig.colors.primary}`}
                          />
                          <span className="text-sm">Produto Fixo (Ex: Coca-Cola)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="type" 
                            value="composed" 
                            checked={formData.type === 'composed'}
                            onChange={() => setFormData({...formData, type: 'composed'})}
                            className={`text-${themeConfig.colors.primary} focus:ring-${themeConfig.colors.primary}`}
                          />
                          <span className="text-sm">Composto (Ex: X-Tudo)</span>
                        </label>
                      </div>
                    </label>
                  </div>

                  {formData.type === 'fixed' ? (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Vincular ao item de estoque:</label>
                      <select 
                        required
                        value={formData.inventoryItemId}
                        onChange={e => setFormData({...formData, inventoryItemId: e.target.value})}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 bg-white"
                      >
                        <option value="">Selecione um item...</option>
                        {inventoryItems.map(item => (
                          <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div className="flex justify-between items-center mb-4">
                        <label className="block text-sm font-semibold text-slate-700">Ingredientes da Receita:</label>
                        <button 
                          type="button"
                          onClick={addIngredient}
                          className="flex items-center gap-1 text-sm text-emerald-600 font-semibold hover:text-emerald-700"
                        >
                          <PlusCircle size={16} /> Adicionar Ingrediente
                        </button>
                      </div>
                      
                      {formData.ingredients.length === 0 && (
                        <p className="text-sm text-slate-500 text-center py-4">Nenhum ingrediente adicionado.</p>
                      )}

                      <div className="space-y-3">
                        {formData.ingredients.map((ing, index) => (
                          <div key={index} className="flex gap-3 items-center">
                            <select 
                              required
                              value={ing.inventoryItemId}
                              onChange={e => updateIngredient(index, 'inventoryItemId', e.target.value)}
                              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 bg-white text-sm"
                            >
                              {inventoryItems.map(item => (
                                <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>
                              ))}
                            </select>
                            <input 
                              type="number"
                              required
                              min="0.01"
                              step="0.01"
                              placeholder="Qtd"
                              value={ing.quantity}
                              onChange={e => updateIngredient(index, 'quantity', e.target.value)}
                              className="w-24 px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 text-sm"
                            />
                            <button 
                              type="button"
                              onClick={() => removeIngredient(index)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                form="product-form"
                className={`px-6 py-2.5 rounded-xl font-medium bg-${themeConfig.colors.primary} text-white hover:bg-${themeConfig.colors.primaryHover} transition-colors shadow-sm`}
              >
                Salvar Produto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
