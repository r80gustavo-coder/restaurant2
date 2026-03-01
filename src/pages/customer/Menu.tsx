import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Socket } from 'socket.io-client';
import { themeConfig } from '../../config/theme';
import { Search, Plus, Minus, ShoppingBag, X } from 'lucide-react';

export default function Menu({ socket }: { socket: Socket | null }) {
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const tableId = localStorage.getItem('tableId');
    if (!tableId) {
      navigate('/login');
      return;
    }

    const fetchData = async () => {
      try {
        const [prodRes, catRes] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/categories')
        ]);
        const prodData = await prodRes.json();
        const catData = await catRes.json();
        
        setProducts(prodData);
        setCategories(catData);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();

    if (socket) {
      socket.on('product_added', fetchData);
      socket.on('product_updated', fetchData);
      socket.on('product_deleted', fetchData);
    }

    return () => {
      if (socket) {
        socket.off('product_added');
        socket.off('product_updated');
        socket.off('product_deleted');
      }
    };
  }, [navigate, socket]);

  const filteredProducts = products.filter(p => {
    const matchesCategory = activeCategory === 'all' || p.categoryId === parseInt(activeCategory);
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

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

  return (
    <div className="pb-24">
      {/* Search Bar */}
      <div className={`bg-${themeConfig.colors.surface} px-4 py-3 sticky top-[72px] z-40 shadow-sm`}>
        <div className="relative">
          <Search className={`absolute left-4 top-1/2 -translate-y-1/2 text-${themeConfig.colors.textMuted}`} size={20} />
          <input
            type="text"
            placeholder="Buscar no cardápio..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-100 border-none focus:ring-2 focus:ring-${themeConfig.colors.primary} text-${themeConfig.colors.text} font-medium placeholder:text-slate-400`}
          />
        </div>
      </div>

      {/* Categories */}
      <div className="px-4 py-6 overflow-x-auto hide-scrollbar">
        <div className="flex gap-3 min-w-max">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-all shadow-sm ${
              activeCategory === 'all'
                ? `bg-${themeConfig.colors.primary} text-white shadow-${themeConfig.colors.primary}/30 scale-105`
                : `bg-white text-${themeConfig.colors.textMuted} hover:bg-slate-50 border border-slate-100`
            }`}
          >
            Todos
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id.toString())}
              className={`px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-all shadow-sm ${
                activeCategory === cat.id.toString()
                  ? `bg-${themeConfig.colors.primary} text-white shadow-${themeConfig.colors.primary}/30 scale-105`
                  : `bg-white text-${themeConfig.colors.textMuted} hover:bg-slate-50 border border-slate-100`
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Product List */}
      <div className="px-4 space-y-4">
        {filteredProducts.map(product => (
          <div 
            key={product.id} 
            onClick={() => { setSelectedProduct(product); setQuantity(1); setNotes(''); }}
            className={`bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex gap-4 cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]`}
          >
            {product.image && (
              <img src={product.image} alt={product.name} className="w-28 h-28 rounded-2xl object-cover shadow-sm" referrerPolicy="no-referrer" />
            )}
            <div className="flex-1 flex flex-col justify-between py-1">
              <div>
                <h3 className={`font-bold text-lg text-${themeConfig.colors.text} leading-tight mb-1`}>{product.name}</h3>
                <p className={`text-sm text-${themeConfig.colors.textMuted} line-clamp-2 leading-snug`}>{product.description}</p>
              </div>
              <p className={`font-black text-lg text-${themeConfig.colors.primary} mt-2`}>
                {themeConfig.currency} {product.price.toFixed(2)}
              </p>
            </div>
          </div>
        ))}
        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className={`text-${themeConfig.colors.textMuted} font-medium`}>Nenhum produto encontrado.</p>
          </div>
        )}
      </div>

      {/* Product Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col justify-end">
          <div className="bg-white rounded-t-[2rem] p-6 pb-8 max-h-[90vh] overflow-y-auto w-full max-w-md mx-auto relative animate-slide-up">
            <button 
              onClick={() => setSelectedProduct(null)}
              className="absolute top-4 right-4 p-2 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition-colors z-10"
            >
              <X size={24} />
            </button>

            {selectedProduct.image && (
              <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-64 object-cover rounded-3xl mb-6 shadow-md" referrerPolicy="no-referrer" />
            )}
            
            <h2 className={`text-2xl font-black text-${themeConfig.colors.text} mb-2`}>{selectedProduct.name}</h2>
            <p className={`text-${themeConfig.colors.textMuted} mb-4 leading-relaxed`}>{selectedProduct.description}</p>
            
            {selectedProduct.type === 'composed' && selectedProduct.ingredients && selectedProduct.ingredients.length > 0 && (
              <div className="mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <h4 className={`text-xs font-bold text-slate-400 uppercase tracking-widest mb-2`}>Ingredientes</h4>
                <p className={`text-sm text-${themeConfig.colors.text} font-medium`}>
                  {selectedProduct.ingredients.map((i: any) => i.name).join(', ')}
                </p>
              </div>
            )}

            <div className="mb-6">
              <label className={`block text-sm font-bold text-${themeConfig.colors.text} mb-3`}>Alguma observação?</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Tirar cebola, ponto da carne..."
                className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none font-medium placeholder:text-slate-400"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between mb-8 bg-slate-50 p-2 rounded-2xl border border-slate-100">
              <button 
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-12 h-12 flex items-center justify-center bg-white text-slate-600 rounded-xl shadow-sm border border-slate-200 active:scale-95 transition-transform"
              >
                <Minus size={20} />
              </button>
              <span className={`text-2xl font-black text-${themeConfig.colors.text} w-16 text-center`}>{quantity}</span>
              <button 
                onClick={() => setQuantity(quantity + 1)}
                className={`w-12 h-12 flex items-center justify-center bg-${themeConfig.colors.primary} text-white rounded-xl shadow-sm active:scale-95 transition-transform`}
              >
                <Plus size={20} />
              </button>
            </div>

            <button 
              onClick={addToCart}
              className={`w-full py-4 bg-${themeConfig.colors.primary} text-white font-black text-lg rounded-2xl flex items-center justify-between px-6 shadow-lg shadow-${themeConfig.colors.primary}/30 active:scale-[0.98] transition-all`}
            >
              <span className="flex items-center gap-2"><ShoppingBag size={22} /> Adicionar</span>
              <span>{themeConfig.currency} {(selectedProduct.price * quantity).toFixed(2)}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
