import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { themeConfig } from '../../config/theme';
import { Trash2, ShoppingBag, ArrowRight, CreditCard, Banknote, Smartphone } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import axios from 'axios';

export default function Cart() {
  const navigate = useNavigate();
  const [cart, setCart] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('stripe'); // stripe, cash, pix
  const orderType = sessionStorage.getItem('orderType');

  useEffect(() => {
    const tableId = sessionStorage.getItem('tableId');
    const customerId = sessionStorage.getItem('customerId');
    if (!orderType && !tableId && !customerId) {
      navigate('/login');
      return;
    }
    const savedCart = JSON.parse(sessionStorage.getItem('cart') || '[]');
    setCart(savedCart);
  }, [navigate]);

  const removeFromCart = (cartItemId: number) => {
    const newCart = cart.filter(item => item.cartItemId !== cartItemId);
    setCart(newCart);
    sessionStorage.setItem('cart', JSON.stringify(newCart));
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const placeOrder = async () => {
    if (cart.length === 0) return;
    setLoading(true);

    const tableId = sessionStorage.getItem('tableId');
    const customerId = sessionStorage.getItem('customerId');
    const address = sessionStorage.getItem('customerAddress');
    
    try {
      const orderData: any = {
        status: 'pending',
        paymentStatus: 'pending',
        total: total,
        type: orderType || 'table'
      };

      if (orderType === 'table' && tableId) {
        orderData.tableId = parseInt(tableId);
      } else if (orderType === 'online' && customerId) {
        orderData.customer_id = parseInt(customerId);
        orderData.delivery_address = { full: address };
        orderData.payment_method = paymentMethod;
      }

      // 1. Criar o pedido na tabela 'orders'
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single();

      if (orderError) throw orderError;
      if (!order) throw new Error('Erro ao criar pedido');

      // 2. Inserir os itens na tabela 'order_items'
      const orderItems = cart.map(item => ({
        orderId: order.id,
        productId: item.id,
        quantity: item.quantity,
        notes: item.notes
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // 3. Atualizar status da mesa para ocupada (se for mesa)
      if (orderType === 'table' && tableId) {
        await supabase
          .from('tables')
          .update({ status: 'ocupada' })
          .eq('id', parseInt(tableId));
      }

      // 4. Handle Stripe Payment
      if (orderType === 'online' && paymentMethod === 'stripe') {
        try {
          const response = await axios.post('/api/stripe/create-checkout-session', {
            items: cart,
            orderId: order.id,
            successUrl: `${window.location.origin}/status`,
            cancelUrl: `${window.location.origin}/cart`
          });
          
          await supabase.from('orders').update({ stripe_session_id: response.data.id }).eq('id', order.id);
          
          sessionStorage.removeItem('cart');
          window.location.href = response.data.url;
          return;
        } catch (error) {
          console.error('Stripe error:', error);
          // Fallback to status page if stripe fails in preview
          sessionStorage.removeItem('cart');
          navigate('/status');
          return;
        }
      }

      if (orderType === 'online' && paymentMethod === 'pix') {
        sessionStorage.removeItem('cart');
        navigate(`/pix-payment/${order.id}`);
        return;
      }

      // 5. Limpar carrinho e redirecionar
      sessionStorage.removeItem('cart');
      setCart([]);
      navigate('/status');
      
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Erro ao enviar pedido. Tente novamente.');
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

      <div className="fixed bottom-[72px] left-0 w-full bg-white border-t border-slate-100 p-4 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-40 max-h-[50vh] overflow-y-auto">
        {orderType === 'online' && (
          <div className="mb-4">
            <h4 className={`text-sm font-bold text-${themeConfig.colors.text} mb-2 px-2`}>Forma de Pagamento</h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPaymentMethod('stripe')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                  paymentMethod === 'stripe' 
                    ? `border-${themeConfig.colors.primary} bg-${themeConfig.colors.primary}/5 text-${themeConfig.colors.primary}` 
                    : 'border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100'
                }`}
              >
                <CreditCard size={24} className="mb-1" />
                <span className="text-xs font-bold">Cartão</span>
              </button>
              <button
                onClick={() => setPaymentMethod('pix')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                  paymentMethod === 'pix' 
                    ? `border-${themeConfig.colors.primary} bg-${themeConfig.colors.primary}/5 text-${themeConfig.colors.primary}` 
                    : 'border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100'
                }`}
              >
                <Smartphone size={24} className="mb-1" />
                <span className="text-xs font-bold">Pix</span>
              </button>
            </div>
          </div>
        )}

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
