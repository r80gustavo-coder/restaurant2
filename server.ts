import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: '10mb' }));

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
