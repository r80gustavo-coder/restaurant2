import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { themeConfig } from '../../config/theme';
import { Copy, CheckCircle2, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function PixPayment() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [order, setOrder] = useState<any>(null);

  // Mock PIX code
  const pixCode = "00020126580014BR.GOV.BCB.PIX0136123e4567-e89b-12d3-a456-426614174000520400005303986540510.005802BR5913Restaurante6008Sao Paulo62070503***63041D3D";

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) return;
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('id', parseInt(orderId))
        .single();
      
      if (data) {
        setOrder(data);
      }
    };
    fetchOrder();
  }, [orderId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(pixCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const confirmPayment = async () => {
    if (!orderId) return;
    
    // In a real app, this would be confirmed via webhook from the payment provider
    // Here we just mock the confirmation
    await supabase
      .from('orders')
      .update({ paymentStatus: 'paid' })
      .eq('id', parseInt(orderId));
      
    navigate('/status');
  };

  if (!order) return <div className="p-8 text-center">Carregando...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center pt-12">
      <button 
        onClick={() => navigate('/status')}
        className="absolute top-6 left-6 p-2 bg-white rounded-full shadow-sm text-slate-500"
      >
        <ArrowLeft size={24} />
      </button>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-8 text-center">
        <h2 className={`text-2xl font-black text-${themeConfig.colors.text} mb-2`}>Pagamento via PIX</h2>
        <p className="text-slate-500 mb-8">Escaneie o QR Code ou copie o código PIX Copia e Cola para finalizar seu pedido.</p>

        <div className="bg-slate-50 p-4 rounded-2xl inline-block mb-8 border border-slate-200">
          {/* Mock QR Code using a placeholder image */}
          <img 
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixCode)}`}
            alt="QR Code PIX" 
            className="w-48 h-48 rounded-xl mix-blend-multiply"
          />
        </div>

        <div className="mb-8">
          <p className="text-sm font-bold text-slate-700 mb-2">Valor a pagar:</p>
          <p className={`text-3xl font-black text-${themeConfig.colors.primary}`}>
            {themeConfig.currency} {order.total.toFixed(2)}
          </p>
        </div>

        <div className="mb-8">
          <p className="text-sm font-bold text-slate-700 mb-2">PIX Copia e Cola</p>
          <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <input 
              type="text" 
              value={pixCode} 
              readOnly 
              className="flex-1 bg-transparent text-sm text-slate-500 px-3 outline-none truncate"
            />
            <button 
              onClick={handleCopy}
              className={`p-3 rounded-lg flex items-center justify-center transition-colors ${
                copied ? 'bg-emerald-100 text-emerald-600' : `bg-${themeConfig.colors.primary}/10 text-${themeConfig.colors.primary} hover:bg-${themeConfig.colors.primary}/20`
              }`}
            >
              {copied ? <CheckCircle2 size={20} /> : <Copy size={20} />}
            </button>
          </div>
        </div>

        <button 
          onClick={confirmPayment}
          className={`w-full py-4 bg-${themeConfig.colors.primary} text-white font-bold rounded-2xl shadow-lg shadow-${themeConfig.colors.primary}/30 active:scale-95 transition-transform`}
        >
          Já realizei o pagamento
        </button>
      </div>
    </div>
  );
}
