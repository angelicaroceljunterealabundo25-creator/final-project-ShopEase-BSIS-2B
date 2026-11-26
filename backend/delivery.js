import { readFile } from 'node:fs/promises';
import { HttpError, string } from './http.js';

export const locations = JSON.parse(await readFile(new URL('../database/psgc-locations.json', import.meta.url), 'utf8'));
export const deliveryArea = 'Polangui, Albay';
export const covers = (municipality) => /\bpolangui\b/i.test(municipality);

export function deliveryLocation(input) {
  const region = locations.find(item => item.code === input.region_code);
  const province = region?.provinces.find(item => item.code === input.province_code);
  const city = province?.cities.find(item => item.code === input.city_code);
  if (!city) throw new HttpError(400, 'Select a valid region, province, and city or municipality.');
  if (!covers(city.name) || province.name !== 'Albay') throw new HttpError(422, `Delivery is currently available in ${deliveryArea}.`);
  return { region: region.name, province: province.name, city: city.name };
}

export function specificAddress(value, location) {
  const details = string(value, 'Specific address', 5, 300);
  const area = [location.city, location.province, location.region];
  const existing = new Set(details.split(',').map(part => part.trim().toLowerCase()));
  return [details, ...area.filter(part => !existing.has(part.toLowerCase()))].join(', ');
}

export function deliveryPhone(value) {
  const phone = typeof value === 'string' ? value.trim().replace(/[\s-]/g, '') : '';
  const digits = phone.replace(/^(?:\+63|0)(?=9)/, '');
  if (!/^9\d{9}$/.test(digits)) throw new HttpError(400, 'Enter a 10-digit Philippine mobile number starting with 9.');
  return `+63${digits}`;
}
