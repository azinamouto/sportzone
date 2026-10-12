import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './server/routes/api.ts';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';
const PORT = 3000;

async function bootstrap() {
  const app = express();

  // JSON request body parser
  app.use(express.json());

  // Mount Laravel-style API endpoints
  app.use('/api', apiRouter);

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    // Custom route aliases for clean URL access
    app.get('/dashboard', (req, res, next) => {
      req.url = '/dashboard.html';
      vite.middlewares(req, res, next);
    });

    app.get('/admin', (req, res, next) => {
      req.url = '/dashboard.html';
      vite.middlewares(req, res, next);
    });

    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));

    app.get('/dashboard', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'dashboard.html'));
    });

    app.get('/admin', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'dashboard.html'));
    });

    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Sports Zone] Fullstack server running on http://0.0.0.0:${PORT}`);
    console.log(`[Sports Zone] Customer UI: http://0.0.0.0:${PORT}/`);
    console.log(`[Sports Zone] Admin Dashboard: http://0.0.0.0:${PORT}/dashboard`);
  });
}

bootstrap().catch(err => {
  console.error('[Sports Zone] Server bootstrap failed:', err);
});
