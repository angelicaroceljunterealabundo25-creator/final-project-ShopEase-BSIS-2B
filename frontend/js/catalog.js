import { addToCart, api, catalogCategories, catalogSorts, date, esc, icon, imageURL, main, money, page, productURL, query } from './shared.js';

export async function home() {
  main.innerHTML = `<div class="shell">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-content">
        <h1 id="hero-title">Make room for <em>good ideas.</em></h1>
        <p>Stationery and study essentials for the classroom, your desk, and whatever you’re working on next.</p>
        <div class="hero-actions"><a class="btn btn-primary" href="#catalog">Browse products ${icon('arrow-down')}</a><a href="/locator.html">Check delivery</a></div>
      </div>
      <img class="hero-image" src="/img/stationery-editorial.webp" srcset="/img/stationery-editorial-small.webp 720w, /img/stationery-editorial.webp 1320w" sizes="(max-width: 767px) calc(100vw - 32px), (max-width: 1328px) 51vw, 670px" alt="An open grid notebook, pencils, and sticky notes on a powder blue desk" width="1320" height="880" fetchpriority="high">
    </section>
    <section id="catalog" class="catalog-section" aria-labelledby="catalog-title">
      <div class="catalog-heading"><div><h2 class="section-title" id="catalog-title" tabindex="-1">Product Catalog</h2><p id="catalog-count" class="text-body-secondary mb-0" role="status"></p></div>
        <div class="catalog-order"><label class="form-label mb-0" for="catalog-sort">Catalog order</label><select class="form-select" id="catalog-sort">${catalogSorts.map(([value, name]) => `<option value="${value}">${name}</option>`).join('')}</select></div>
      </div>
      <div class="catalog-filters"><div id="categories" class="d-flex flex-wrap gap-2" aria-label="Categories" role="group"></div><a id="catalog-clear" href="/#catalog" hidden>Clear search and filters</a></div>
      <div id="product-list" class="row g-3 g-lg-4"></div><nav id="pagination" class="d-flex justify-content-center gap-2 mt-4" aria-label="Product pages"></nav>
    </section></div>`;
  const list = document.querySelector('#product-list');
  const count = document.querySelector('#catalog-count');
  const categoryBar = document.querySelector('#categories');
  const pagination = document.querySelector('#pagination');
  const sort = document.querySelector('#catalog-sort');
  const clear = document.querySelector('#catalog-clear');
  const headerSort = document.querySelector('#header-sort');
  sort.value = headerSort.value;
  let category = query.get('category') || '';
  let currentPage = 1;
  let controller;
  let catalog = new Map();

  const render = async () => {
    controller?.abort();
    controller = new AbortController();
    const { signal } = controller;
    const filter = new URLSearchParams({ q: query.get('q') || '', sort: sort.value, category, page: currentPage });
    if (query.get('max')) filter.set('max', String(Number(query.get('max')) * 100));
    clear.hidden = !(category || query.get('q') || query.get('max') || sort.value !== 'featured');
    count.textContent = 'Loading products…';
    list.setAttribute('aria-busy', 'true');
    try {
      const { items, total } = await api(`/products?${filter}`, { signal });
      catalog = new Map(items.map(item => [item.id, item]));
      count.textContent = `${total} ${total === 1 ? 'product' : 'products'}`;
      list.innerHTML = items.length ? items.map(card).join('') : '<div class="col"><div class="panel empty-state"><h3>No products found</h3><p class="mb-0">Try a different search or category.</p></div></div>';
      pagination.innerHTML = total > 9 ? `<button class="btn btn-outline-primary" data-page="${currentPage - 1}" ${currentPage <= 1 ? 'disabled' : ''}>Previous</button><span class="align-self-center px-2">Page ${currentPage} of ${Math.ceil(total / 9)}</span><button class="btn btn-outline-primary" data-page="${currentPage + 1}" ${currentPage * 9 >= total ? 'disabled' : ''}>Next</button>` : '';
    } catch (error) {
      if (error.name === 'AbortError') return;
      count.textContent = error.message;
      list.innerHTML = '<div class="col"><div class="panel empty-state"><button class="btn btn-outline-primary" type="button" data-retry>Retry loading products</button></div></div>';
      pagination.replaceChildren();
    } finally { if (!signal.aborted) list.setAttribute('aria-busy', 'false'); }
  };
  pagination.addEventListener('click', (event) => {
    const button = event.target.closest('[data-page]');
    if (!button) return;
    currentPage = Number(button.dataset.page);
    render();
    document.querySelector('#catalog-title').focus({ preventScroll: true });
    document.querySelector('#catalog').scrollIntoView();
  });
  function filterChanged() {
    const filter = new URLSearchParams(query);
    for (const [name, value] of [['category', category], ['sort', sort.value === 'featured' ? '' : sort.value]]) {
      if (value) filter.set(name, value);
      else filter.delete(name);
    }
    const search = filter.toString();
    history.replaceState(null, '', `/${search ? '?' + search : ''}${location.hash}`);
    currentPage = 1;
    render();
  }
  sort.addEventListener('change', () => { headerSort.value = sort.value; filterChanged(); });
  list.addEventListener('click', (event) => {
    if (event.target.closest('[data-retry]')) { render(); return; }
    const button = event.target.closest('[data-add]');
    const product = catalog.get(button?.dataset.add);
    if (!product || !addToCart(product)) return;
    button.classList.add('is-added');
    button.innerHTML = `${icon('check')} Added`;
    clearTimeout(button.feedbackTimer);
    button.feedbackTimer = setTimeout(() => {
      button.classList.remove('is-added');
      button.textContent = 'Add to cart';
    }, 1400);
  });
  try {
    const categories = await catalogCategories();
    categoryBar.innerHTML = ['', ...categories].map(item => `<button type="button" class="category-chip" data-category="${esc(item)}" aria-pressed="${item === category}">${esc(item || 'All products')}</button>`).join('');
    categoryBar.addEventListener('click', (event) => {
      const button = event.target.closest('[data-category]');
      if (!button) return;
      category = button.dataset.category;
      document.querySelector('#header-category').value = category;
      categoryBar.querySelectorAll('button').forEach(chip => chip.setAttribute('aria-pressed', String(chip === button)));
      filterChanged();
    });
  } catch { categoryBar.textContent = 'Categories are temporarily unavailable.'; }
  await render();
  if (location.hash === '#catalog') document.querySelector('#catalog').scrollIntoView();
}

function card(item) {
  return `<div class="col-12 col-sm-6 col-lg-4"><article class="product-card d-flex flex-column" data-reveal>
    <a class="product-media${item.brand ? ' product-media-branded' : ''}" href="${productURL(item)}" tabindex="-1" aria-hidden="true"><img src="${imageURL(item.image)}" alt="" width="720" height="514" loading="lazy"><span class="product-arrow">${icon('arrow-up-right')}</span></a>
    <div class="product-card-body flex-grow-1 d-flex flex-column"><p class="product-category">${esc(item.brand || item.category)}</p><h3><a href="${productURL(item)}">${esc(item.name)}</a></h3>
      <p class="product-meta mb-3">${item.review_count ? `<span class="review-star" aria-hidden="true">★</span> <span class="visually-hidden">Rating</span> ${item.rating.toFixed(1)} <span aria-hidden="true">·</span> ${item.review_count} ${item.review_count === 1 ? 'review' : 'reviews'}` : 'No reviews yet'}</p>
      <div class="product-card-action"><strong class="product-price">${money(item.price_cents)}</strong>
      <button type="button" class="btn btn-outline-primary btn-sm" data-add="${esc(item.id)}" aria-label="Add ${esc(item.name)} to cart" ${item.stock ? '' : 'disabled'}>${item.stock ? 'Add to cart' : 'Sold out'}</button></div>
    </div></article></div>`;
}

export async function product() {
  const item = await api(`/products/${encodeURIComponent(query.get('id') || '')}`);
  const max = Math.max(1, Math.min(50, item.stock));
  const reviews = item.reviews;
  const renderReview = review => `<article class="review" data-reveal><div class="review-heading"><strong>${esc(review.name)}</strong><span class="review-rating" aria-label="${review.rating} out of 5"><span class="review-star" aria-hidden="true">★</span> ${review.rating}/5</span></div><p>${esc(review.comment)}</p><time class="text-body-secondary small" datetime="${esc(review.created_at)}">${date(review.created_at)}</time></article>`;
  page(`<a href="/#catalog" class="back-link">${icon('arrow-left')} Product Catalog</a>
    <div class="product-detail"><img class="product-detail-image${item.brand ? ' product-detail-branded' : ''}" src="${imageURL(item.image)}" alt="${esc(item.name)}" width="720" height="600">
    <div class="product-detail-content"><p class="product-category">${[item.brand, item.category].filter(Boolean).map(esc).join(' · ')}</p><h1>${esc(item.name)}</h1>
      ${item.review_count ? `<p><a class="review-link" href="#review-title"><span class="review-star" aria-hidden="true">★</span> ${item.rating.toFixed(1)} / 5 · ${item.review_count} ${item.review_count === 1 ? 'review' : 'reviews'}</a></p>` : ''}
      <p class="product-description">${esc(item.description)}</p><div class="product-detail-price"><strong class="product-price fs-3">${money(item.price_cents)}</strong><span class="status-tag ${item.stock ? 'delivered' : 'cancelled'}">${item.stock ? `${item.stock} in stock` : 'Out of stock'}</span></div>
      <form id="product-form" class="product-buy" action="#" method="POST"><div><label class="form-label" for="quantity">Quantity</label><div class="quantity-stepper">
        <button type="button" data-step="-1" aria-label="Decrease quantity" disabled>−</button><input class="form-control" id="quantity" name="quantity" type="number" inputmode="numeric" min="1" max="${max}" value="1" required ${item.stock ? '' : 'disabled'}><button type="button" data-step="1" aria-label="Increase quantity" ${max > 1 ? '' : 'disabled'}>+</button>
      </div></div><button class="btn btn-primary" ${item.stock ? '' : 'disabled'}>${icon('cart')} Add to cart</button></form></div></div>
    <section class="reviews-section" aria-labelledby="review-title"><div class="reviews-heading"><h2 id="review-title">Customer reviews</h2>${item.review_count ? `<span class="review-rating"><span class="review-star" aria-hidden="true">★</span> ${item.rating.toFixed(1)} average</span>` : ''}</div>
      ${reviews.length ? `<div class="review-grid">${reviews.slice(0, 6).map(renderReview).join('')}</div>${reviews.length > 6 ? `<details class="more-reviews"><summary class="btn btn-outline-primary">More reviews (${reviews.length - 6})</summary><div class="review-grid">${reviews.slice(6).map(renderReview).join('')}</div></details>` : ''}` : '<p class="text-body-secondary">No reviews yet. You can review this product after delivery.</p>'}</section>`);
  const form = document.querySelector('#product-form');
  const quantity = form.elements.quantity;
  const [less, more] = form.querySelectorAll('[data-step]');
  function updateStepper() {
    less.disabled = !item.stock || quantity.valueAsNumber <= 1;
    more.disabled = !item.stock || quantity.valueAsNumber >= max;
  }
  for (const button of [less, more]) button.addEventListener('click', () => {
    quantity.value = Math.min(max, Math.max(1, (quantity.valueAsNumber || 1) + Number(button.dataset.step)));
    updateStepper();
    if (button.disabled) quantity.focus();
  });
  quantity.addEventListener('input', updateStepper);
  form.addEventListener('submit', event => { event.preventDefault(); addToCart(item, quantity.valueAsNumber); });
}
