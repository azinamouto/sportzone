import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import app from './server/app.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

async function bootstrap() {
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
