import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import Stripe from 'stripe';
import axios from 'axios';
import { GoogleGenAI } from '@google/genai';

let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is required');
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function sendEvolutionMessage(phone: string, message: string) {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME;

  if (!apiUrl || !apiKey || !instanceName) {
    console.warn('Evolution API not configured. Message not sent:', message);
    return;
  }

  try {
    await axios.post(
      `${apiUrl}/message/sendText/${instanceName}`,
      {
        number: phone,
        options: { delay: 1200, presence: 'composing' },
        textMessage: { text: message }
      },
      { headers: { apikey: apiKey } }
    );
  } catch (error) {
    console.error('Error sending Evolution message:', error);
  }
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: '10mb' }));

  // Stripe Checkout
  app.post('/api/stripe/create-checkout-session', async (req, res) => {
    try {
      const { items, orderId, successUrl, cancelUrl } = req.body;
      const stripe = getStripe();
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: items.map((item: any) => ({
          price_data: {
            currency: 'brl',
            product_data: { name: item.name },
            unit_amount: Math.round(item.price * 100),
          },
          quantity: item.quantity,
        })),
        mode: 'payment',
        success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        client_reference_id: orderId.toString(),
      });

      res.json({ id: session.id, url: session.url });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Evolution API Webhook / Send Message
  app.post('/api/evolution/send-message', async (req, res) => {
    try {
      const { phone, message } = req.body;
      await sendEvolutionMessage(phone, message);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // AI Promotions
  app.post('/api/ai/analyze-promotions', async (req, res) => {
    try {
      const { customers } = req.body;
      
      const prompt = `
        Analise o histórico de pedidos destes clientes e gere uma mensagem de WhatsApp promocional 
        para aqueles com alta chance de comprar novamente. Retorne um JSON com a lista de clientes 
        e a mensagem sugerida para cada um.
        
        Clientes: ${JSON.stringify(customers)}
        
        Formato esperado:
        [
          { "customerId": "id", "phone": "numero", "message": "mensagem sugerida" }
        ]
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      const result = JSON.parse(response.text || '[]');
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
