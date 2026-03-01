import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { themeConfig } from '../../config/theme';
import { Search, Plus, Minus, ShoppingBag, X, Sparkles, UtensilsCrossed } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const tableId = localStorage.getItem('tableId');
    if (!tableId) {
      navigate('/login');
      return;
    }

    const fetchData = async () => {
      try {
        const [prodRes, catRes] = await Promise.all([
          supabase.from('products').select('*').order('name'),
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

  const filteredProducts = products.filter(p => {
    const matchesCategory = activeCategory ? p.categoryId === parseInt(activeCategory) : true;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // If search is active, we show products regardless of category selection
  const showProducts = activeCategory !== null || searchQuery.length > 0;

  const addToCart = () => {
    if (!selectedProduct) return;

    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    cart.push({
      ...selectedProduct,
      cartItemId: Date.now(),
      quantity,
      notes
    });
    localStorage.setItem('cart', JSON.stringify(cart));
    
    setSelectedProduct(null);
    setQuantity(1);
    setNotes('');
  };

  const generateSuggestion = () => {
    if (products.length === 0) return;
    setIsGenerating(true);
    
    // Simulate "thinking" time
    setTimeout(() => {
      const randomProduct = products[Math.floor(Math.random() * products.length)];
      setSelectedProduct(randomProduct);
      setQuantity(1);
      setNotes('');
      setIsGenerating(false);
    }, 800);
  };

  return (
    <div className="pb-24 bg-slate-50 min-h-screen">
      {/* Search & Generate Header */}
      <div className={`bg-${themeConfig.colors.surface} px-6 py-4 sticky top-[72px] z-40 shadow-sm border-b border-slate-100`}>
        <div className="flex gap-3">
          {activeCategory && !searchQuery && (
            <button 
              onClick={() => setActiveCategory(null)}
              className="p-3.5 rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            >
              <X size={20} />
            </button>
          )}
          <div className="relative flex-1">
            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 text-${themeConfig.colors.textMuted}`} size={20} />
            <input
              type="text"
              placeholder="O que você deseja comer hoje?"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-100 border-2 border-transparent focus:bg-white focus:border-${themeConfig.colors.primary} focus:outline-none focus:ring-0 text-${themeConfig.colors.text} font-medium placeholder:text-slate-400 transition-all shadow-inner`}
            />
          </div>
          <button
            onClick={generateSuggestion}
            disabled={isGenerating}
            className={`px-4 rounded-2xl bg-gradient-to-br from-${themeConfig.colors.primary} to-emerald-500 text-white shadow-lg shadow-emerald-200 active:scale-95 transition-all flex items-center justify-center min-w-[56px]`}
            title="Sugestão do Chef"
          >
            {isGenerating ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles size={24} />
              </motion.div>
            ) : (
              <Sparkles size={24} />
            )}
          </button>
        </div>
      </div>

      {!showProducts ? (
        /* Categories Grid */
        <div className="p-6">
          <h2 className={`text-xl font-bold text-${themeConfig.colors.text} mb-4`}>Categorias</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.map((cat) => (
              <motion.div
                key={cat.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveCategory(cat.id.toString())}
                className="relative h-32 rounded-2xl overflow-hidden shadow-sm cursor-pointer group"
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
                    <UtensilsCrossed size={32} className={`text-${themeConfig.colors.primary}/20`} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-4">
                  <h3 className="text-white font-bold text-lg leading-tight">{cat.name}</h3>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        /* Product List */
        <div className="px-6 py-6 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className={`text-xl font-bold text-${themeConfig.colors.text}`}>
              {searchQuery ? 'Resultados da busca' : categories.find(c => c.id.toString() === activeCategory)?.name || 'Produtos'}
            </h2>
            <span className={`text-sm font-medium text-${themeConfig.colors.textMuted}`}>
              {filteredProducts.length} itens
            </span>
          </div>

          <AnimatePresence mode='popLayout'>
            {filteredProducts.map(product => (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                key={product.id} 
                onClick={() => { setSelectedProduct(product); setQuantity(1); setNotes(''); }}
                className={`bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 flex gap-4 cursor-pointer hover:shadow-md hover:border-${themeConfig.colors.primary}/20 transition-all active:scale-[0.98] group`}
              >
                {product.image ? (
                  <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-sm shrink-0">
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-300 shrink-0">
                    <UtensilsCrossed size={24} />
                  </div>
                )}
                <div className="flex-1 flex flex-col justify-between py-1">
                  <div>
                    <h3 className={`font-bold text-lg text-${themeConfig.colors.text} leading-tight mb-1 line-clamp-1`}>{product.name}</h3>
                    <p className={`text-xs text-${themeConfig.colors.textMuted} line-clamp-2 leading-relaxed`}>{product.description}</p>
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
              </motion.div>
            ))}
          </AnimatePresence>
          
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

      {/* Product Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col justify-end"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white rounded-t-[2.5rem] p-8 pb-10 max-h-[90vh] overflow-y-auto w-full max-w-md mx-auto relative shadow-2xl"
            >
              <button 
                onClick={() => setSelectedProduct(null)}
                className="absolute top-6 right-6 p-2 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition-colors z-10"
              >
                <X size={24} />
              </button>

              {selectedProduct.image && (
                <div className="rounded-3xl overflow-hidden mb-8 shadow-lg">
                  <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-64 object-cover" referrerPolicy="no-referrer" />
                </div>
              )}
              
              <h2 className={`text-3xl font-black text-${themeConfig.colors.text} mb-3 leading-tight`}>{selectedProduct.name}</h2>
              <p className={`text-${themeConfig.colors.textMuted} mb-6 leading-relaxed text-lg`}>{selectedProduct.description}</p>
              
              {selectedProduct.type === 'composed' && selectedProduct.ingredients && selectedProduct.ingredients.length > 0 && (
                <div className="mb-8 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <h4 className={`text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2`}>
                    <UtensilsCrossed size={14} /> Ingredientes
                  </h4>
                  <p className={`text-base text-${themeConfig.colors.text} font-medium leading-relaxed`}>
                    {selectedProduct.ingredients.map((i: any) => i.name).join(', ')}
                  </p>
                </div>
              )}

              <div className="mb-8">
                <label className={`block text-sm font-bold text-${themeConfig.colors.text} mb-3 ml-1`}>Alguma observação?</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Tirar cebola, ponto da carne..."
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none font-medium placeholder:text-slate-400 transition-all"
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between mb-8 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                <button 
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-14 h-14 flex items-center justify-center bg-white text-slate-600 rounded-xl shadow-sm border border-slate-200 active:scale-95 transition-transform hover:bg-slate-50"
                >
                  <Minus size={24} />
                </button>
                <span className={`text-3xl font-black text-${themeConfig.colors.text} w-20 text-center`}>{quantity}</span>
                <button 
                  onClick={() => setQuantity(quantity + 1)}
                  className={`w-14 h-14 flex items-center justify-center bg-${themeConfig.colors.primary} text-white rounded-xl shadow-sm active:scale-95 transition-transform hover:bg-${themeConfig.colors.primaryHover}`}
                >
                  <Plus size={24} />
                </button>
              </div>

              <button 
                onClick={addToCart}
                className={`w-full py-5 bg-${themeConfig.colors.primary} text-white font-black text-xl rounded-2xl flex items-center justify-between px-8 shadow-xl shadow-${themeConfig.colors.primary}/30 active:scale-[0.98] transition-all hover:translate-y-[-2px]`}
              >
                <span className="flex items-center gap-3"><ShoppingBag size={24} /> Adicionar</span>
                <span>{themeConfig.currency} {(selectedProduct.price * quantity).toFixed(2)}</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
