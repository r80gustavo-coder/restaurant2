import { useState, useEffect } from 'react';
import { themeConfig } from '../../config/theme';
import { MessageSquare, Sparkles, Send, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import axios from 'axios';
import { motion } from 'framer-motion';

export default function Marketing() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          orders (
            id,
            total,
            created_at,
            items:order_items(product:products(name))
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const generatePromotions = async () => {
    setLoading(true);
    try {
      // Format data for AI
      const customerData = customers.map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        totalOrders: c.orders?.length || 0,
        lastOrderDate: c.orders?.[0]?.created_at,
        favoriteItems: c.orders?.flatMap((o: any) => o.items.map((i: any) => i.product.name)).slice(0, 3)
      }));

      const response = await axios.post('/api/ai/analyze-promotions', { customers: customerData });
      setPromotions(response.data);
    } catch (error) {
      console.error('Error generating promotions:', error);
      alert('Erro ao gerar promoções com IA.');
    } finally {
      setLoading(false);
    }
  };

  const sendMessages = async () => {
    if (promotions.length === 0) return;
    setSending(true);
    try {
      for (const promo of promotions) {
        await axios.post('/api/evolution/send-message', {
          phone: promo.phone,
          message: promo.message
        });
      }
      alert('Mensagens enviadas com sucesso!');
      setPromotions([]);
    } catch (error) {
      console.error('Error sending messages:', error);
      alert('Erro ao enviar mensagens.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className={`text-2xl font-bold text-${themeConfig.colors.text}`}>Marketing & IA</h2>
          <p className={`text-${themeConfig.colors.textMuted}`}>Analise clientes e envie promoções automáticas</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={generatePromotions}
            disabled={loading || customers.length === 0}
            className={`flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-bold shadow-lg shadow-indigo-200 disabled:opacity-50`}
          >
            {loading ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                <Sparkles size={20} />
              </motion.div>
            ) : (
              <Sparkles size={20} />
            )}
            Analisar Clientes com IA
          </button>
          
          {promotions.length > 0 && (
            <button
              onClick={sendMessages}
              disabled={sending}
              className={`flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-bold shadow-lg shadow-emerald-200 disabled:opacity-50`}
            >
              <Send size={20} />
              {sending ? 'Enviando...' : 'Disparar WhatsApp'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
              <Users size={24} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Base de Clientes</h3>
              <p className="text-sm text-slate-500">{customers.length} cadastrados</p>
            </div>
          </div>
          
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            {customers.map(customer => (
              <div key={customer.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-bold text-slate-800">{customer.name}</p>
                <p className="text-sm text-slate-500">{customer.phone}</p>
                <div className="mt-2 flex gap-2 text-xs font-medium">
                  <span className="px-2 py-1 bg-white rounded-md border border-slate-200">
                    {customer.orders?.length || 0} pedidos
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
              <MessageSquare size={24} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Sugestões da IA</h3>
              <p className="text-sm text-slate-500">
                {promotions.length > 0 ? `${promotions.length} mensagens prontas para envio` : 'Clique em Analisar para gerar mensagens'}
              </p>
            </div>
          </div>

          {promotions.length > 0 ? (
            <div className="space-y-4">
              {promotions.map((promo, idx) => (
                <div key={idx} className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-bold text-indigo-900">Para: {customers.find(c => c.id === promo.customerId)?.name || promo.phone}</p>
                  </div>
                  <p className="text-slate-700 whitespace-pre-wrap">{promo.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400">
              <Sparkles size={48} className="mb-4 opacity-20" />
              <p>A IA analisará o histórico de compras e criará</p>
              <p>mensagens personalizadas para cada cliente.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
