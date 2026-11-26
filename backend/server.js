import express from 'express';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { accounts } from './accounts.js';
import { catalog } from './catalog.js';
import { googleMapsDemoKey, host, port, production, seedDemo } from './config.js';
import { openDatabase } from './db.js';
import { HttpError, sameOrigin } from './http.js';
import { orders } from './orders.js';
import { reports } from './reports.js';
import { seedAccounts, seedCatalog } from './seed.js';

const framePolicy = 'frame-src https://www.google.com https://www.openstreetmap.org';
const commonPolicy = `default-src 'self'; ${framePolicy}; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`;
const defaultPolicy = `${commonPolicy}; img-src 'self' data:; style-src 'self' 'unsafe-inline'`;
const googleMapsPolicy = [commonPolicy,
  "script-src 'self' https://maps.googleapis.com https://maps.gstatic.com",
  "img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.googleusercontent.com",
  "connect-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.google.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "worker-src 'self' blob:",
].join('; ');

export function createApp(db, services) {
  const app = express();
  app.disable('x-powered-by');
  if (production) app.set('trust proxy', 1);
  app.use((req, res, next) => {
    const useGoogleMaps = googleMapsDemoKey && req.path.toLowerCase() === '/locator.html';
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY', 'Content-Security-Policy': useGoogleMaps ? googleMapsPolicy : defaultPolicy });
    next();
  });
  app.use('/api', express.json({ limit: '64kb' }), (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    req.body ??= {};
    next();
  }, sameOrigin);
  app.get('/api/health', async (_req, res) => {
    await db.ping();
    res.json({ status: 'ok', database: 'mongodb' });
  });
  app.use('/api', accounts(db, services), catalog(db), orders(db), reports(db));
  app.use('/api', () => { throw new HttpError(404, 'API route not found.'); });

  const require = createRequire(import.meta.url);
  app.use('/vendor', express.static(dirname(require.resolve('bootstrap/dist/css/bootstrap.min.css')), { index: false }));
  app.use('/vendor', express.static(dirname(require.resolve('bootstrap/dist/js/bootstrap.bundle.min.js')), { index: false }));
  app.use(express.static(fileURLToPath(new URL('../frontend/', import.meta.url))));
  app.use((_req, res) => res.status(404).send('ShopEase page not found.'));
  app.use((error, _req, res, _next) => {
    const client = error.status >= 400 && error.status < 500;
    if (!client) console.error('ShopEase request failed:', error.code || error.name);
    res.status(client ? error.status : 500).json({ message: client ? error.message : 'Something went wrong. Please try again.' });
  });
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = await openDatabase();
  if (seedDemo) {
    await seedCatalog(db);
    await seedAccounts(db);
  }
  const server = createApp(db).listen(port, host, () => console.log(`ShopEase is running at http://${host}:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      server.close(async () => { await db.close(); process.exit(0); });
      setTimeout(() => server.closeAllConnections(), 2000).unref();
    });
  }
}
