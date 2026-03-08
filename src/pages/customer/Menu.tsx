import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { themeConfig } from '../../config/theme';
import { Search, Plus, Minus, ShoppingBag, X, Sparkles, UtensilsCrossed } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';

export default function Menu() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const orderType = sessionStorage.getItem('orderType');
    const tableId = sessionStorage.getItem('tableId');
    const customerId = sessionStorage.getItem('customerId');

    if (!orderType && !tableId && !customerId) {
      navigate('/login');
      return;
    }

    const fetchData = async () => {
      try {
        const [prodRes, catRes] = await Promise.all([
          supabase.from('products').select(`
            *,
            inventory_item:inventory_items (
              currentStock
            ),
            ingredients:product_ingredients (
              quantity,
              inventory_item:inventory_items (
                name,
                currentStock
              )
            )
          `).order('name'),
          supabase.from('categories').select('*').order('name')
        ]);

        if (prodRes.error) throw prodRes.error;
        if (catRes.error) throw catRes.error;
        
        setProducts(prodRes.data || []);
        setCategories(catRes.data || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();

    // Realtime subscriptions
    const productsChannel = supabase
      .channel('menu-products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchData();
      })
      .subscribe();

    const categoriesChannel = supabase
      .channel('menu-categories')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(categoriesChannel);
    };
  }, [navigate]);

  const isProductInStock = (product: any) => {
    if (product.type === 'fixed') {
      return (product.inventory_item?.currentStock || 0) >= 1;
    } else if (product.type === 'composed') {
      if (!product.ingredients || product.ingredients.length === 0) return false;
      for (const ingredient of product.ingredients) {
        if ((ingredient.inventory_item?.currentStock || 0) < ingredient.quantity) {
          return false;
        }
      }
      return true;
    }
    return true;
  };

  const filteredProducts = products.filter(p => {
    if (p.name.startsWith('[Excluído]')) return false;
    if (!isProductInStock(p)) return false;
    const matchesCategory = activeCategory ? p.categoryId === parseInt(activeCategory) : true;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    // Only show visible products
    return matchesCategory && matchesSearch && p.visible !== false;
  });

  // If search is active, we show products regardless of category selection
  const showProducts = activeCategory !== null || searchQuery.length > 0;

  const addToCart = () => {
    if (!selectedProduct) return;

    const cart = JSON.parse(sessionStorage.getItem('cart') || '[]');
    cart.push({
      ...selectedProduct,
      cartItemId: Date.now(),
      quantity,
      notes
    });
    sessionStorage.setItem('cart', JSON.stringify(cart));
    
    setSelectedProduct(null);
    setQuantity(1);
    setNotes('');
  };

  return (
    <div className="pb-24 bg-slate-50 min-h-screen">
      {/* Search Header */}
      <div className={`bg-${themeConfig.colors.surface} px-4 sm:px-6 py-4 sticky top-[72px] z-40 shadow-sm border-b border-slate-100`}>
        <div className="flex gap-3">
          {activeCategory && !searchQuery && (
            <button 
              onClick={() => setActiveCategory(null)}
              className="p-3.5 rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors shrink-0"
            >
              <X size={20} />
            </button>
          )}
          <div className="relative flex-1">
            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 text-${themeConfig.colors.textMuted}`} size={20} />
            <input
              type="text"
              placeholder="O que deseja comer?"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-100 border-2 border-transparent focus:bg-white focus:border-${themeConfig.colors.primary} focus:outline-none focus:ring-0 text-${themeConfig.colors.text} font-medium placeholder:text-slate-400 transition-all shadow-inner text-sm sm:text-base`}
            />
          </div>
        </div>
      </div>

      {!showProducts ? (
        /* Categories Grid */
        <div className="p-4 sm:p-6">
          <h2 className={`text-xl font-bold text-${themeConfig.colors.text} mb-4`}>Categorias</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {categories.map((cat) => (
              <div key={cat.id} className="relative h-28 sm:h-32 rounded-2xl overflow-hidden shadow-sm cursor-pointer group">
                <div 
                  onClick={() => setActiveCategory(cat.id.toString())}
                  className="absolute inset-0 z-20"
                />
                <motion.div
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="absolute inset-0 z-10 w-full h-full bg-transparent" />
                </motion.div>
                {cat.image ? (
                  <img 
                    src={cat.image} 
                    alt={cat.name} 
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className={`absolute inset-0 bg-${themeConfig.colors.surface} flex items-center justify-center`}>
                    <UtensilsCrossed size={32} className={`text-${themeConfig.colors.primary}/20`} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-4 pointer-events-none">
                  <h3 className="text-white font-bold text-lg leading-tight">{cat.name}</h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Product List */
        <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className={`text-xl font-bold text-${themeConfig.colors.text}`}>
              {searchQuery ? 'Resultados da busca' : categories.find(c => c.id.toString() === activeCategory)?.name || 'Produtos'}
            </h2>
            <span className={`text-sm font-medium text-${themeConfig.colors.textMuted}`}>
              {filteredProducts.length} itens
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode='popLayout'>
              {filteredProducts.map(product => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  key={product.id}
                >
                  <div 
                    onClick={() => { setSelectedProduct(product); setQuantity(1); setNotes(''); }}
                    className={`bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex gap-4 cursor-pointer hover:shadow-md hover:border-${themeConfig.colors.primary}/20 transition-all active:scale-[0.98] group h-full`}
                  >
                    {product.image ? (
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shadow-sm shrink-0">
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                      </div>
                    ) : (
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-300 shrink-0">
                        <UtensilsCrossed size={24} />
                      </div>
                    )}
                    <div className="flex-1 flex flex-col justify-between py-1">
                      <div>
                        <h3 className={`font-bold text-lg text-${themeConfig.colors.text} leading-tight mb-1 line-clamp-1`}>{product.name}</h3>
                        <p className={`text-xs text-${themeConfig.colors.textMuted} line-clamp-2 leading-relaxed`}>{product.description}</p>
                        {product.type === 'composed' && product.ingredients && product.ingredients.length > 0 && (
                          <p className={`text-xs text-${themeConfig.colors.textMuted} mt-1 italic line-clamp-1`}>
                            {product.ingredients.map((i: any) => i.inventory_item?.name).filter(Boolean).join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="flex justify-between items-end mt-2">
                        <p className={`font-black text-lg text-${themeConfig.colors.primary}`}>
                          {themeConfig.currency} {product.price.toFixed(2)}
                        </p>
                        <div className={`w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-${themeConfig.colors.primary} group-hover:bg-${themeConfig.colors.primary} group-hover:text-white transition-colors`}>
                          <Plus size={16} />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          
          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                <Search size={24} />
              </div>
              <p className={`text-${themeConfig.colors.textMuted} font-medium`}>Nenhum produto encontrado.</p>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <div 
              onClick={() => setSelectedProduct(null)}
              className="absolute inset-0 z-0"
            >
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
              </motion.div>
            </div>
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              <div className="bg-white rounded-t-[2.5rem] p-6 pb-12 max-h-[85vh] overflow-y-auto w-full max-w-md mx-auto relative shadow-2xl flex flex-col">
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-slate-200 rounded-full mb-4" />
                
                <button 
                  onClick={() => setSelectedProduct(null)}
                  className="absolute top-6 right-6 p-2 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition-colors z-10"
                >
                  <X size={24} />
                </button>

                <div className="flex-1 overflow-y-auto -mx-6 px-6">
                  {selectedProduct.image && (
                    <div className="rounded-3xl overflow-hidden mb-6 shadow-lg mt-8">
                      <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-56 object-cover" referrerPolicy="no-referrer" />
                    </div>
                  )}
                  
                  <h2 className={`text-2xl font-black text-${themeConfig.colors.text} mb-2 leading-tight`}>{selectedProduct.name}</h2>
                  <p className={`text-${themeConfig.colors.textMuted} mb-6 leading-relaxed`}>{selectedProduct.description}</p>
                  
                  {selectedProduct.type === 'composed' && selectedProduct.ingredients && selectedProduct.ingredients.length > 0 && (
                    <div className="mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <h4 className={`text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2`}>
                        <UtensilsCrossed size={14} /> Ingredientes
                      </h4>
                      <p className={`text-sm text-${themeConfig.colors.text} font-medium leading-relaxed`}>
                        {selectedProduct.ingredients.map((i: any) => i.inventory_item?.name).filter(Boolean).join(', ')}
                      </p>
                    </div>
                  )}

                  <div className="mb-6">
                    <label className={`block text-sm font-bold text-${themeConfig.colors.text} mb-2 ml-1`}>Alguma observação?</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ex: Tirar cebola, ponto da carne..."
                      className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none font-medium placeholder:text-slate-400 transition-all"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 bg-white">
                  <div className="flex items-center justify-between mb-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                    <button 
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-12 h-12 flex items-center justify-center bg-white text-slate-600 rounded-xl shadow-sm border border-slate-200 active:scale-95 transition-transform hover:bg-slate-50"
                    >
                      <Minus size={20} />
                    </button>
                    <span className={`text-2xl font-black text-${themeConfig.colors.text} w-16 text-center`}>{quantity}</span>
                    <button 
                      onClick={() => setQuantity(quantity + 1)}
                      className={`w-12 h-12 flex items-center justify-center bg-${themeConfig.colors.primary} text-white rounded-xl shadow-sm active:scale-95 transition-transform hover:bg-${themeConfig.colors.primaryHover}`}
                    >
                      <Plus size={20} />
                    </button>
                  </div>

                  <button 
                    onClick={addToCart}
                    className={`w-full py-4 bg-${themeConfig.colors.primary} text-white font-black text-lg rounded-2xl flex items-center justify-between px-6 shadow-xl shadow-${themeConfig.colors.primary}/30 active:scale-[0.98] transition-all hover:translate-y-[-2px]`}
                  >
                    <span className="flex items-center gap-2"><ShoppingBag size={20} /> Adicionar</span>
                    <span>{themeConfig.currency} {(selectedProduct.price * quantity).toFixed(2)}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
