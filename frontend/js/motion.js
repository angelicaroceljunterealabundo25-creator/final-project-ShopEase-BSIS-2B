export function setupScrollReveals(root) {
  if (!('IntersectionObserver' in window)) return;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const active = new Map();
  const observer = new IntersectionObserver(entries => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting) continue;
      observer.unobserve(target);
      if (preference.matches || target.matches(':focus-within')) continue;
      const animation = target.animate([
        { opacity: .55, translate: '0 9px' },
        { opacity: 1, translate: '0 0' },
      ], { duration: 330, easing: 'cubic-bezier(.2,.7,.3,1)' });
      active.set(target, animation);
      animation.onfinish = animation.oncancel = () => active.delete(target);
    }
  }, { threshold: .12 });

  function observe(node) {
    if (!(node instanceof Element)) return;
    if (node.matches('[data-reveal]')) observer.observe(node);
    node.querySelectorAll('[data-reveal]').forEach(element => observer.observe(element));
  }

  observe(root);
  new MutationObserver(changes => {
    for (const { addedNodes, removedNodes } of changes) {
      addedNodes.forEach(observe);
      if (!removedNodes.length) continue;
      for (const node of removedNodes) {
        if (!(node instanceof Element) || node.isConnected) continue;
        if (node.matches('[data-reveal]')) observer.unobserve(node);
        node.querySelectorAll('[data-reveal]').forEach(element => observer.unobserve(element));
      }
    }
  }).observe(root, { childList: true, subtree: true });
  root.addEventListener('focusin', event => active.get(event.target.closest('[data-reveal]'))?.cancel());
  preference.addEventListener('change', () => {
    if (preference.matches) active.forEach(animation => animation.cancel());
  });
}
