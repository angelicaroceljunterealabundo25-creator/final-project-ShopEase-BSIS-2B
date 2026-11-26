export function mountGoogleMap(container, { key, center }, title, useFallback) {
  let failed = false;
  function fallback() {
    if (failed) return;
    failed = true;
    clearTimeout(timeout);
    useFallback();
  }

  const timeout = setTimeout(fallback, 15_000);
  window.gm_authFailure = fallback;
  window.initShopEaseMap = async () => {
    delete window.initShopEaseMap;
    if (failed) return;
    try {
      const google = window.google;
      const [{ Map }, { AdvancedMarkerElement }] = await Promise.all([
        google.maps.importLibrary('maps'), google.maps.importLibrary('marker'),
      ]);
      if (failed) return;
      const map = new Map(container, {
        center, zoom: 14, zoomControl: true, mapId: 'DEMO_MAP_ID', mapTypeControl: false, streetViewControl: false,
        gestureHandling: 'cooperative',
      });
      new AdvancedMarkerElement({ map, position: center, title });
      google.maps.event.addListenerOnce(map, 'idle', () => {
        clearTimeout(timeout);
        container.removeAttribute('aria-busy');
      });
    } catch { fallback(); }
  };

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({
    key, loading: 'async', callback: 'initShopEaseMap', v: 'weekly', region: 'PH', auth_referrer_policy: 'origin',
  })}`;
  script.onerror = fallback;
  document.head.append(script);
}
