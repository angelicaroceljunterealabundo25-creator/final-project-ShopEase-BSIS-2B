import jwt from 'jsonwebtoken';
import { appOrigin, jwtSecret, production } from './config.js';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function string(value, label, min, max) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (trimmed.length < min || trimmed.length > max) throw new HttpError(400, `${label} must contain ${min}–${max} characters.`);
  return trimmed;
}

export function integer(value, label, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new HttpError(400, `${label} must be between ${min} and ${max}.`);
  return value;
}

export function id(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) throw new HttpError(400, 'Invalid record ID.');
  return value.toLowerCase();
}

export function readEmail(value) {
  const email = string(value, 'Email', 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.');
  return email;
}

export function readPhone(value) {
  const phone = string(value, 'Phone', 7, 25);
  if (!/^\+?[\d -]+$/.test(phone) || phone.replace(/\D/g, '').length < 7) throw new HttpError(400, 'Enter a valid phone number.');
  return phone;
}

export function readPassword(value) {
  if (typeof value !== 'string' || value.length < 10 || Buffer.byteLength(value) > 72) throw new HttpError(400, 'Use a password with at least 10 characters and no more than 72 bytes.');
  return value;
}

const cookieOptions = { httpOnly: true, secure: production, sameSite: 'lax', path: '/' };
export const userFields = '-_id id name email phone address role active created_at updated_at';

export function setSession(response, user) {
  const token = jwt.sign({ version: user.session_version ?? 0 }, jwtSecret, { subject: user.id, expiresIn: '12h', algorithm: 'HS256' });
  response.cookie('shopease_session', token, { ...cookieOptions, maxAge: 43_200_000 });
}

export function clearSession(response) { response.clearCookie('shopease_session', cookieOptions); }

export function requireUser(db, ...roles) {
  return async (request, _response, next) => {
    const cookie = request.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith('shopease_session='));
    let payload;
    try { payload = jwt.verify(cookie?.slice('shopease_session='.length) || '', jwtSecret, { algorithms: ['HS256'] }); }
    catch { throw new HttpError(401, 'Sign in to continue.'); }
    const user = await db.User.findOne({ id: payload.sub, review_fixture: { $ne: true } }).select(`${userFields} avatar session_version`).lean();
    if (!user?.active || user.session_version !== payload.version) throw new HttpError(401, 'Sign in to continue.');
    if (roles.length && !roles.includes(user.role)) throw new HttpError(403, 'Your account does not have permission for this action.');
    request.user = user;
    next();
  };
}

export function sameOrigin(request, _response, next) {
  const origin = request.headers.origin;
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
      ((origin && origin !== appOrigin) || request.headers['sec-fetch-site'] === 'cross-site')) {
    throw new HttpError(403, 'This request must come from the ShopEase site.');
  }
  next();
}

export function rateLimit(limit, interval) {
  const hits = new Map();
  let nextCleanup = 0;
  return (request, _response, next) => {
    const now = Date.now();
    if (now >= nextCleanup) {
      for (const [key, entry] of hits) if (entry.expires <= now) hits.delete(key);
      nextCleanup = now + interval;
    }
    const key = request.ip;
    let entry = hits.get(key);
    if (!entry || entry.expires <= now) {
      entry = { count: 0, expires: now + interval };
      hits.set(key, entry);
    }
    if (++entry.count > limit) throw new HttpError(429, 'Too many attempts. Try again later.');
    next();
  };
}
