import { Router } from 'express';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { appOrigin, dataDirectory, production } from './config.js';
import { HttpError, clearSession, id, rateLimit, readEmail, readPassword, readPhone, requireUser, setSession, string, userFields } from './http.js';
import { publicRecord } from './models.js';

const dummyHash = await bcrypt.hash(randomUUID(), 12);
const digest = (token) => createHash('sha256').update(token).digest('hex');

export function accounts(db, { sendReset = sendPasswordReset } = {}) {
  const router = Router();
  const { User, PasswordReset } = db;
  const signedIn = requireUser(db);
  const admin = requireUser(db, 'admin');
  const authLimit = rateLimit(30, 15 * 60_000);

  async function createUser(body, role, contact = {}) {
    const name = string(body.name, 'Name', 2, 100);
    const email = readEmail(body.email);
    const passwordHash = await bcrypt.hash(readPassword(body.password), 12);
    let user;
    try { user = await User.create({ id: randomUUID(), name, email, password_hash: passwordHash, role, ...contact }); }
    catch (error) {
      if (error.code === 11000 && error.keyPattern?.email) throw new HttpError(409, 'An account already uses this email.');
      throw error;
    }
    return user;
  }

  const register = async (req, res) => {
    const user = await createUser(req.body, 'customer', {
      phone: readPhone(req.body.phone), address: string(req.body.address, 'Address', 5, 300),
    });
    setSession(res, user);
    res.status(201).json(accountProfile(user));
  };
  router.post(['/register', '/users'], authLimit, register);

  router.post('/login', authLimit, async (req, res) => {
    const email = readEmail(req.body.email);
    const input = req.body.password;
    if (typeof input !== 'string' || Buffer.byteLength(input) > 72) throw new HttpError(401, 'Email or password is incorrect.');
    const user = await User.findOne({ email, review_fixture: { $ne: true } }).select(`${userFields} avatar password_hash session_version`).lean();
    const valid = await bcrypt.compare(input, user?.password_hash || dummyHash);
    const access = req.body.access;
    const roleAllowed = access === undefined || (access === 'customer' && user?.role === 'customer') ||
      (access === 'team' && ['admin', 'staff'].includes(user?.role));
    if (!user?.active || !valid || !roleAllowed) throw new HttpError(401, 'Email or password is incorrect for this sign-in option.');
    const { password_hash, session_version, ...profile } = user;
    setSession(res, user);
    res.json(profile);
  });
  router.post('/logout', (_req, res) => { clearSession(res); res.status(204).end(); });
  router.get('/me', signedIn, (req, res) => {
    const { session_version, ...user } = req.user;
    res.json(user);
  });
  router.put('/me/avatar', signedIn, async (req, res) => {
    const avatar = readAvatar(req.body.avatar);
    await User.updateOne({ id: req.user.id }, { $set: { avatar } });
    res.json({ avatar });
  });
  router.delete('/me/avatar', signedIn, async (req, res) => {
    await User.updateOne({ id: req.user.id }, { $set: { avatar: null } });
    res.status(204).end();
  });

  router.put('/users/:id', signedIn, async (req, res) => {
    if (id(req.params.id) !== req.user.id) throw new HttpError(403, 'You can edit only your own profile.');
    const name = string(req.body.name, 'Name', 2, 100);
    const phone = readPhone(req.body.phone);
    const address = string(req.body.address, 'Address', 5, 300);
    const updated = await User.findOneAndUpdate({ id: req.user.id }, { $set: { name, phone, address } }, { returnDocument: 'after', runValidators: true }).select(`${userFields} avatar`).lean();
    res.json(updated);
  });
  router.get('/users', admin, async (_req, res) => {
    res.json(await User.find({ review_fixture: { $ne: true } }).select(userFields).sort({ created_at: -1 }).lean());
  });
  router.post('/admin/users', admin, async (req, res) => {
    const { role } = req.body;
    if (!['admin', 'staff'].includes(role)) throw new HttpError(400, 'Choose Staff or Administrator.');
    const user = await createUser(req.body, role);
    res.status(201).json(accountProfile(user));
  });
  router.patch('/users/:id/role', admin, async (req, res) => {
    if (!['staff', 'customer'].includes(req.body.role)) throw new HttpError(400, 'Select Staff or Customer.');
    const updated = await User.findOneAndUpdate(manageableUser(req.params.id), { $set: { role: req.body.role } }, { returnDocument: 'after' }).select(userFields).lean();
    if (!updated) throw new HttpError(404, 'Manageable account not found.');
    res.json(updated);
  });
  router.delete('/users/:id', admin, async (req, res) => {
    const updated = await User.updateOne(manageableUser(req.params.id), { $set: { active: false }, $inc: { session_version: 1 } });
    if (!updated.matchedCount) throw new HttpError(404, 'Manageable account not found.');
    res.status(204).end();
  });
  router.post('/users/:id/reactivate', admin, async (req, res) => {
    const updated = await User.updateOne(manageableUser(req.params.id), { $set: { active: true } });
    if (!updated.matchedCount) throw new HttpError(404, 'Manageable account not found.');
    res.status(204).end();
  });

  router.post('/password/forgot', authLimit, async (req, res) => {
    const email = readEmail(req.body.email);
    const user = await User.findOne({ email, active: true, review_fixture: { $ne: true } }).select('id').lean();
    if (user) {
      const token = randomBytes(32).toString('hex');
      await PasswordReset.updateOne({ user_id: user.id }, { $set: {
        token_hash: digest(token), expires_at: new Date(Date.now() + 20 * 60_000),
      } }, { upsert: true });
      await sendReset(email, `${appOrigin}/reset.html#${token}`).catch((error) => console.error('Password reset delivery failed:', error.code || error.name));
    }
    res.json({ message: 'If the account exists, a reset link will be sent.' });
  });

  router.post('/password/reset', authLimit, async (req, res) => {
    const token = string(req.body.token, 'Reset token', 64, 64);
    const passwordHash = await bcrypt.hash(readPassword(req.body.password), 12);
    await db.transaction(async (session) => {
      const reset = await PasswordReset.findOneAndDelete({ token_hash: digest(token), expires_at: { $gt: new Date() } }, { session }).lean();
      if (!reset) throw new HttpError(400, 'This reset link is invalid or expired.');
      await User.updateOne({ id: reset.user_id, active: true }, { $set: { password_hash: passwordHash }, $inc: { session_version: 1 } }, { session });
    });
    clearSession(res);
    res.json({ message: 'Password changed. You can now sign in.' });
  });
  return router;
}

function accountProfile(user) {
  const { password_hash, session_version, ...profile } = publicRecord(user);
  return profile;
}

function manageableUser(value) {
  return { id: id(value), role: { $ne: 'admin' }, review_fixture: { $ne: true } };
}

function readAvatar(value) {
  const invalid = () => new HttpError(400, 'Choose a valid profile photo.');
  const match = typeof value === 'string' && value.length <= 60_023 && /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw invalid();
  const image = Buffer.from(match[1], 'base64');
  if (image.length < 16 || image.toString('base64') !== match[1] || image.readUInt16BE(0) !== 0xffd8 || image.readUInt16BE(image.length - 2) !== 0xffd9) throw invalid();

  let offset = 2;
  while (offset + 4 < image.length && image[offset] === 0xff) {
    const marker = image[offset + 1];
    const size = image.readUInt16BE(offset + 2);
    if (size < 2 || offset + 2 + size > image.length) break;
    if (marker === 0xc0 || marker === 0xc2) {
      if (size < 8) break;
      const height = image.readUInt16BE(offset + 5);
      const width = image.readUInt16BE(offset + 7);
      if (height > 0 && width > 0 && height <= 256 && width <= 256) return value;
      break;
    }
    if (marker === 0xda) break;
    offset += 2 + size;
  }
  throw invalid();
}

async function sendPasswordReset(email, url) {
  const text = `Open this link within 20 minutes to reset your ShopEase password:\n${url}`;
  if (process.env.SMTP_URL && process.env.MAIL_FROM) {
    const transport = nodemailer.createTransport(process.env.SMTP_URL);
    await transport.sendMail({ from: process.env.MAIL_FROM, to: email, subject: 'Reset your ShopEase password', text });
    return;
  }
  if (production) throw new Error('Password reset email is not configured.');
  const inbox = join(dataDirectory, 'outbox');
  await mkdir(inbox, { recursive: true });
  await writeFile(join(inbox, `${Date.now()}-${randomUUID()}.txt`), `To: ${email}\n\n${text}`, { mode: 0o600 });
}
