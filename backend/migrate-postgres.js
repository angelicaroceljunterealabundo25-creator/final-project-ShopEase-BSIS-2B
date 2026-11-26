import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { dataDirectory } from './config.js';
import { openDatabase } from './db.js';
import { reviewFixtureIds } from './seed.js';

async function migrate() {
  const source = join(dataDirectory, 'postgres');
  await access(join(source, 'PG_VERSION'));
  const postgres = new PGlite(source);
  let mongo;
  try {
    const { rows: users } = await postgres.query('SELECT * FROM users');
    const fixtureUsers = new Set([
      [reviewFixtureIds(0).userId, 'sample-mia@shopease.test'],
      [reviewFixtureIds(1).userId, 'sample-rafael@shopease.test'],
    ].filter(([id, email]) => users.some(user => user.id === id && user.email === email && !user.active)).map(([id]) => id));
    const { rows: products } = await postgres.query('SELECT * FROM products');
    const { rows: vouchers } = await postgres.query('SELECT * FROM vouchers');
    const { rows: orders } = await postgres.query('SELECT * FROM orders');
    const { rows: events } = await postgres.query('SELECT * FROM order_events');
    const { rows: reviews } = await postgres.query('SELECT * FROM reviews');
    mongo = await openDatabase();
    await mongo.transaction(async session => {
      await copy(mongo.User, 'id', users.map(user => ({ ...user, review_fixture: fixtureUsers.has(user.id) })), session);
      await copy(mongo.Product, 'id', products, session);
      await copy(mongo.Voucher, 'code', vouchers, session);
      await copy(mongo.Order, 'id', orders.map(order => ({ ...order, review_fixture: fixtureUsers.has(order.user_id),
        payment_status: order.payment_status === 'simulated' ? 'recorded' : order.payment_status })), session);
      await copy(mongo.OrderEvent, 'id', events, session);
      await copy(mongo.Review, 'id', reviews.map(review => ({ ...review, review_fixture: fixtureUsers.has(review.user_id) })), session);
    });
    console.log(`Atlas database ${mongo.name} now has the migrated data for ${users.length} accounts, ${products.length} products, ${orders.length} orders, and ${reviews.length} reviews.`);
  } finally {
    await postgres.close();
    await mongo?.close();
  }
}

async function copy(model, identity, rows, session) {
  if (!rows.length) return;
  await model.bulkWrite(rows.map(row => ({
    updateOne: { filter: { [identity]: row[identity] }, update: { $setOnInsert: row }, upsert: true, timestamps: false },
  })), { session });
}

migrate().catch(error => {
  console.error('PostgreSQL import failed:', error.code || error.name);
  process.exitCode = 1;
});
