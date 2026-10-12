import 'dotenv/config';
import express, { type ErrorRequestHandler } from 'express';
import apiRouter from './routes/api.ts';

const app = express();
app.use(express.json());
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use('/api', apiRouter);
app.use('/api', (_req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found' });
});
const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error('[Sports Zone] API error:', error);
  res.status(500).json({ success: false, message: 'The service is unavailable. Please try again later.' });
};
app.use('/api', handleError);

export default app;
