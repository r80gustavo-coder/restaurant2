import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Socket } from 'socket.io-client';
import { themeConfig } from '../../config/theme';
import { Trash2, ShoppingBag, ArrowRight } from 'lucide-react';

export default function Cart({ socket }: { socket: Socket | null }) {
  const navigate = useNavigate();
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const tableId = localStorage.getItem('tableId');
    if (!tableId) {
      navigate('/login');
      return;
    }
    const savedCart = JSON.parse(localStorage.getItem('cart') || '[]');
    setCart(savedCart);
  }, [navigate]);

  const removeFromCart = (cartItemId: number) => {
    const newCart = cart.filter(item => item.cartItemId !== cartItemId);
    setCart(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const placeOrder = async () => {
    if (cart.length === 0) return;
    setLoading(true);

    const tableId = localStorage.getItem('tableId');
    
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: parseInt(tableId!),
          items: cart.map(item => ({
            productId: item.id,
            quantity: item.quantity,
            notes: item.notes
          })),
          total
        })
      });

      if (res.ok) {
        localStorage.removeItem('cart');
        setCart([]);
        navigate('/status');
      }
    } catch (error) {
      console.error('Error placing order:', error);
    } finally {
      setLoading(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className={`w-24 h-24 bg-${themeConfig.colors.primary}/10 rounded-full flex items-center justify-center text-${themeConfig.colors.primary} mb-6`}>
          <ShoppingBag size={48} />
        </div>
        <h2 className={`text-2xl font-black text-${themeConfig.colors.text} mb-2`}>Seu carrinho está vazio</h2>
        <p className={`text-${themeConfig.colors.textMuted} mb-8 font-medium`}>Adicione itens do cardápio para fazer seu pedido.</p>
        <button 
          onClick={() => navigate('/')}
          className={`px-8 py-4 bg-${themeConfig.colors.primary} text-white font-bold rounded-2xl shadow-lg shadow-${themeConfig.colors.primary}/30 active:scale-95 transition-transform`}
        >
          Ver Cardápio
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 pb-32">
      <h2 className={`text-2xl font-black text-${themeConfig.colors.text} mb-6 px-2`}>Seu Pedido</h2>
      
      <div className="space-y-4 mb-8">
        {cart.map((item) => (
          <div key={item.cartItemId} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex gap-4 relative">
            {item.image && (
              <img src={item.image} alt={item.name} className="w-24 h-24 rounded-2xl object-cover shadow-sm" referrerPolicy="no-referrer" />
            )}
            <div className="flex-1 py-1">
              <div className="flex justify-between items-start pr-8">
                <h3 className={`font-bold text-lg text-${themeConfig.colors.text} leading-tight mb-1`}>
                  <span className="text-slate-400 mr-2">{item.quantity}x</span>
                  {item.name}
                </h3>
              </div>
              <p className={`font-black text-lg text-${themeConfig.colors.primary} mt-1`}>
                {themeConfig.currency} {(item.price * item.quantity).toFixed(2)}
              </p>
              {item.notes && (
                <p className="text-xs text-orange-600 mt-2 bg-orange-50 px-3 py-1.5 rounded-lg inline-block font-medium border border-orange-100">
                  Obs: {item.notes}
                </p>
              )}
            </div>
            <button 
              onClick={() => removeFromCart(item.cartItemId)}
              className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
            >
              <Trash2 size={20} />
            </button>
          </div>
        ))}
      </div>

      <div className="fixed bottom-[72px] left-0 w-full bg-white border-t border-slate-100 p-4 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-40">
        <div className="flex justify-between items-center mb-4 px-2">
          <span className={`text-lg font-bold text-${themeConfig.colors.textMuted}`}>Total</span>
          <span className={`text-3xl font-black text-${themeConfig.colors.text}`}>
            {themeConfig.currency} {total.toFixed(2)}
          </span>
        </div>
        
        <button 
          onClick={placeOrder}
          disabled={loading}
          className={`w-full py-4 bg-${themeConfig.colors.primary} text-white font-black text-lg rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-${themeConfig.colors.primary}/30 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all group`}
        >
          {loading ? 'Enviando...' : 'Confirmar Pedido'}
          {!loading && <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />}
        </button>
      </div>
    </div>
  );
}
