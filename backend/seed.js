import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import importedCatalog from './catalog-seed.json' with { type: 'json' };
import { readEmail, readPassword } from './http.js';
import { productReviews, reviewAuthors } from './review-fixtures.js';

const legacySlugs = Object.keys(productReviews);

export async function seedCatalog(db) {
  await db.Product.bulkWrite(importedCatalog.map(({ source_url, ...product }) => ({
    updateOne: { filter: { slug: product.slug }, update: { $setOnInsert: { ...product, id: randomUUID(), active: true } },
      upsert: true, timestamps: { createdAt: true, updatedAt: false } },
  })));
  await db.Product.updateMany({ slug: { $in: legacySlugs }, active: true }, { $set: { active: false } });
}

export async function seedAccounts(db) {
  const passwordHash = await bcrypt.hash('ShopEaseDemo2026!', 12);
  for (const role of ['customer', 'staff', 'admin']) {
    await db.User.updateOne({ email: `${role}@shopease.test` }, { $setOnInsert: {
      id: randomUUID(), name: `ShopEase ${role}`, password_hash: passwordHash, role, phone: '09170000000', address: 'Demo delivery address, Polangui, Albay',
    } }, { upsert: true, timestamps: { createdAt: true, updatedAt: false } });
  }
  await seedVouchers(db);
}

export async function seedVouchers(db) {
  const expires = new Date(Date.now() + 180 * 86_400_000);
  const vouchers = [['HELLO5', 5, 0], ['STUDY10', 10, 20000], ['SCHOOL15', 15, 50000]];
  await db.Voucher.bulkWrite(vouchers.map(([code, percent, minimum]) => ({
    updateOne: { filter: { code }, update: { $setOnInsert: { percent, minimum_cents: minimum, expires_at: expires, active: true } }, upsert: true },
  })));
}

export async function bootstrapAdmin(db, { email, password }) {
  if (!email && !password) return;
  const address = readEmail(email);
  const initialPassword = readPassword(password);
  if (address.endsWith('@shopease.test') || initialPassword.length < 16) {
    throw new Error('Use a real admin email and a private password of at least 16 characters.');
  }
  if (await db.User.exists({ role: 'admin', active: true })) return;
  const password_hash = await bcrypt.hash(initialPassword, 12);
  const account = await db.User.findOneAndUpdate({ email: address }, { $setOnInsert: {
    id: randomUUID(), name: 'ShopEase administrator', password_hash, role: 'admin',
  } }, { upsert: true, returnDocument: 'after', timestamps: { createdAt: true, updatedAt: false } }).select('role active').lean();
  if (account.role !== 'admin' || !account.active) throw new Error('Choose an unused email for the initial administrator.');
}

export function reviewFixtureIds(index) {
  const sequence = String(index + 1).padStart(3, '0');
  return { userId: `50000000-0000-4000-8000-000000001${sequence}`, orderId: `50000000-0000-4000-8000-000000002${sequence}` };
}

export async function seedReviews(db) {
  const rows = await db.Product.find({ slug: { $in: Object.keys(productReviews) } }).sort({ slug: 1 }).lean();
  if (!rows.length) return;
  const items = rows.map(product => ({ product_id: product.id, name: product.name, price_cents: product.price_cents, quantity: 1 }));
  const total = items.reduce((sum, item) => sum + item.price_cents, 0);
  const existingEmails = ['sample-mia@shopease.test', 'sample-rafael@shopease.test'];
  const reviewers = reviewAuthors.map((name, index) => ({
    ...reviewFixtureIds(index), name, index, email: existingEmails[index] ?? `reviewer-${index + 1}@shopease.test`,
  }));
  await db.transaction(async session => {
    await db.User.bulkWrite(reviewers.map(({ userId, name, email }) => ({
      updateOne: { filter: { id: userId, email, active: false }, update: { $set: { name, review_fixture: true },
        $setOnInsert: { role: 'customer', password_hash: '', session_version: 0 } }, upsert: true },
    })), { session });
    await db.Order.bulkWrite(reviewers.map(({ userId, orderId }) => ({
      updateOne: { filter: { id: orderId, user_id: userId }, update: { $set: { items, subtotal_cents: total, total_cents: total, review_fixture: true },
        $setOnInsert: { request_id: orderId, delivery_cents: 0, discount_cents: 0, status: 'delivered', payment_method: 'cash_on_delivery',
          payment_status: 'received', shipping_address: 'Polangui, Albay', phone: '+639170000000', created_at: new Date(Date.now() - 14 * 86_400_000) } }, upsert: true, timestamps: false },
    })), { session });
    await db.Review.bulkWrite(reviewers.flatMap(({ userId, orderId, index }) => rows.map((product, position) => {
      const rating = index === 10 ? 3 : (index + position) % 3 === 0 ? 4 : 5;
      const writtenAt = new Date(Date.now() - (12 - index) * 86_400_000);
      return { updateOne: { filter: { user_id: userId, order_id: orderId, product_id: product.id }, update: { $set: { review_fixture: true },
        $setOnInsert: { id: randomUUID(), rating, comment: productReviews[product.slug][index], created_at: writtenAt, updated_at: writtenAt } }, upsert: true, timestamps: false } };
    })), { session });
  });
}
