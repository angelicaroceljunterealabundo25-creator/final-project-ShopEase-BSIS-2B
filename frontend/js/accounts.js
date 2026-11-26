import { api, avatarMarkup, esc, feedback, handleForm, main, message, nextPage, page, pageTitle, query, signedIn, state } from './shared.js';

function field(name, label, { type = 'text', value = '', max = 100, min = 0, autocomplete = '', readonly = false } = {}) {
  return `<div class="mb-3"><label class="form-label" for="${name}">${label}</label><input class="form-control" id="${name}" name="${name}" type="${type}" value="${esc(value)}" maxlength="${max}" ${min ? `minlength="${min}"` : ''} ${autocomplete ? `autocomplete="${autocomplete}"` : ''} ${readonly ? 'readonly' : 'required'}></div>`;
}

const emailField = () => field('email', 'Email address', { type: 'email', max: 254, autocomplete: 'email' });
const passwordField = (isNew = false) => field('password', isNew ? 'New password' : 'Password', { type: 'password', min: isNew ? 10 : 0, max: 72, autocomplete: isNew ? 'new-password' : 'current-password' });
const accountFields = (profile = {}) => field('name', 'Full name', { value: profile.name, min: 2, autocomplete: 'name' }) +
  field('phone', 'Phone number', { type: 'tel', value: profile.phone, min: 7, max: 25, autocomplete: 'tel' }) +
  field('address', 'Delivery address', { value: profile.address, min: 5, max: 300, autocomplete: 'street-address' });

function authPanel(title, detail, form, links = '') {
  page(`<div class="auth-layout"><div class="auth-content">${pageTitle(title, detail)}${form}${links}</div><div class="auth-visual" aria-hidden="true"><img src="/img/stationery-editorial.webp" alt="" width="1320" height="880"></div></div>`);
}

export function login() {
  const next = query.get('next');
  const team = query.get('access') === 'team';
  const registration = next ? `/register.html?next=${encodeURIComponent(next)}` : '/register.html';
  const customerLogin = next ? `/login.html?next=${encodeURIComponent(next)}` : '/login.html';
  const teamLogin = `/login.html?access=team${next?.startsWith('/dashboard.html') ? '&next=' + encodeURIComponent(next) : ''}`;
  if (state.user) { location.replace(nextPage()); return; }
  const options = `<nav class="sign-in-options" aria-label="Sign-in options">
    <a href="${esc(customerLogin)}" ${team ? '' : 'aria-current="page"'}>Customer</a>
    <a href="${esc(teamLogin)}" ${team ? 'aria-current="page"' : ''}>Staff &amp; admin</a>
  </nav>`;
  authPanel(team ? 'Staff & admin sign in' : 'Sign in', team ? 'Use the account issued by a ShopEase administrator.' : 'Sign in to track orders, check out, and manage your profile.',
    `${options}<form id="login-form" action="#" method="POST">${emailField()}${passwordField()}<button class="btn btn-primary w-100">Sign in</button>${feedback}</form>`,
    `<div class="d-flex flex-wrap justify-content-between gap-3 mt-3">${team ? '' : `<a href="${esc(registration)}">Create an account</a>`}<a href="/forgot.html">Forgot password?</a></div>`);
  handleForm(document.querySelector('#login-form'), async body => {
    state.user = await api('/login', { method: 'POST', body: { ...body, access: team ? 'team' : 'customer' } });
    location.assign(nextPage());
  });
}

export function register() {
  if (state.user) { location.replace(nextPage()); return; }
  authPanel('Create an account', 'Save your delivery information and track your orders.', `<form id="register-form" action="#" method="POST">${emailField()}${field('password', 'Password (at least 10 characters)', { type: 'password', min: 10, max: 72, autocomplete: 'new-password' })}${accountFields()}<button class="btn btn-primary w-100">Create account</button>${feedback}</form>`, '<p class="mt-3 mb-0"><a href="/login.html">Already registered? Sign in</a></p>');
  handleForm(document.querySelector('#register-form'), async body => { state.user = await api('/users', { method: 'POST', body }); location.assign(nextPage()); });
}

export function profile() {
  if (!signedIn()) return;
  page(`${pageTitle('My profile', 'Update your photo, contact information, and delivery address.')}<div class="row g-4"><section class="col-lg-5"><div class="panel profile-photo-panel"><div class="profile-photo-heading"><div class="profile-avatar" id="profile-avatar" role="img" aria-label="Profile photo">${avatarMarkup(state.user.avatar)}</div><div><h2 class="h4 mb-1">Profile photo</h2><p id="profile-display-name" class="mb-0">${esc(state.user.name)}</p></div></div>
    <form id="avatar-form" action="#" method="POST"><label class="form-label" for="avatar-file">Choose a photo</label><input class="form-control mb-2" id="avatar-file" name="photo" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="avatar-formats" required><p class="form-text mt-0" id="avatar-formats">JPG, PNG, or WebP, up to 10 MB.</p><div class="d-flex flex-wrap gap-2"><button class="btn btn-primary" id="save-avatar" disabled>Save photo</button><button class="btn btn-outline-secondary" type="button" id="remove-avatar" ${state.user.avatar ? '' : 'hidden'}>Remove photo</button></div>${feedback}</form></div></section>
    <section class="col-lg-7"><div class="panel"><h2 class="h4 mb-3">Contact and delivery</h2><form id="profile-form" action="#" method="POST">${field('email', 'Email address', { value: state.user.email, type: 'email', readonly: true })}${accountFields(state.user)}<button class="btn btn-primary">Save profile</button>${feedback}</form></div></section></div>`);
  const form = document.querySelector('#profile-form');
  handleForm(form, async body => {
    state.user = await api(`/users/${state.user.id}`, { method: 'PUT', body });
    main.querySelector('#profile-display-name').textContent = state.user.name;
    message(form, 'Profile saved.', false);
  });
  photoEditor();
}

function photoEditor() {
  const form = main.querySelector('#avatar-form');
  const file = form.elements.photo;
  const save = form.querySelector('#save-avatar');
  const remove = form.querySelector('#remove-avatar');
  const preview = main.querySelector('#profile-avatar');
  let draft;
  let selection = 0;
  const update = (value) => {
    state.user.avatar = value;
    preview.innerHTML = avatarMarkup(value);
    remove.hidden = !value;
    document.dispatchEvent(new Event('profile-avatar-changed'));
  };
  file.addEventListener('change', async () => {
    const current = ++selection;
    draft = undefined;
    save.disabled = true;
    message(form, '');
    if (!file.files[0]) { preview.innerHTML = avatarMarkup(state.user.avatar); return; }
    try {
      const photo = await resizePhoto(file.files[0]);
      if (current !== selection) return;
      draft = photo;
      preview.innerHTML = avatarMarkup(draft);
      save.disabled = false;
    } catch (error) {
      if (current !== selection) return;
      preview.innerHTML = avatarMarkup(state.user.avatar);
      message(form, error.message);
    }
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!draft || save.disabled) return;
    save.disabled = file.disabled = remove.disabled = true;
    try {
      const { avatar } = await api('/me/avatar', { method: 'PUT', body: { avatar: draft } });
      update(avatar);
      draft = undefined;
      file.value = '';
      message(form, 'Profile photo saved.', false);
    } catch (error) { message(form, error.message); }
    finally { file.disabled = remove.disabled = false; save.disabled = !draft; }
  });
  remove.addEventListener('click', async () => {
    ++selection;
    save.disabled = file.disabled = remove.disabled = true;
    try {
      await api('/me/avatar', { method: 'DELETE' });
      draft = undefined;
      file.value = '';
      update(null);
      message(form, 'Profile photo removed.', false);
    } catch (error) { message(form, error.message); }
    finally { file.disabled = remove.disabled = false; save.disabled = !draft; }
  });
}

async function resizePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error('Choose a JPG, PNG, or WebP photo under 10 MB.');
  const source = await createImageBitmap(file).catch(() => { throw new Error('This photo could not be opened. Choose a different file.'); });
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 192;
    const context = canvas.getContext('2d');
    const side = Math.min(source.width, source.height);
    context.fillStyle = '#fff';
    context.fillRect(0, 0, 192, 192);
    context.drawImage(source, (source.width - side) / 2, (source.height - side) / 2, side, side, 0, 0, 192, 192);
    return canvas.toDataURL('image/jpeg', 0.74);
  } finally { source.close(); }
}

export function forgot() {
  authPanel('Reset your password', 'Enter your account email to request a new password link.', `<form id="forgot-form" action="#" method="POST">${emailField()}<button class="btn btn-primary">Send reset link</button>${feedback}</form><p class="mt-3 mb-0"><a href="/login.html">Back to sign in</a></p>`);
  const form = document.querySelector('#forgot-form');
  handleForm(form, async body => { const result = await api('/password/forgot', { method: 'POST', body }); message(form, result.message, false); });
}

export function reset() {
  const token = location.hash.slice(1);
  if (token) history.replaceState(null, '', location.pathname);
  if (!/^[0-9a-f]{64}$/.test(token)) { authPanel('Reset link unavailable', '', '<a href="/forgot.html">Request a new reset link</a>'); return; }
  authPanel('Choose a new password', 'Use at least 10 characters.', `<form id="reset-form" action="#" method="POST">${passwordField(true)}<button class="btn btn-primary">Change password</button>${feedback}</form><p class="mt-3 mb-0"><a href="/login.html">Back to sign in</a></p>`);
  const form = document.querySelector('#reset-form');
  handleForm(form, async ({ password }) => { const result = await api('/password/reset', { method: 'POST', body: { token, password } }); form.reset(); message(form, result.message, false); });
}
