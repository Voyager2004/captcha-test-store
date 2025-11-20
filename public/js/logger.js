(() => {
  const send = (events) => {
    try {
      fetch('/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
        keepalive: true,
      });
    } catch {}
  };

  const buf = [];
  const push = (type, data = {}) => {
    buf.push({ type, t: Date.now(), path: location.pathname, data });
    if (buf.length >= 10) flush();
  };
  const flush = () => {
    if (buf.length) {
      const copy = buf.splice(0, buf.length);
      send(copy);
    }
  };

  window.addEventListener('load', () => {
    push('page_load', {
      ref: document.referrer,
      hw: navigator.hardwareConcurrency,
      dm: navigator.deviceMemory,
      lang: navigator.language,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      webdriver: !!navigator.webdriver,
      plugins: (navigator.plugins || []).length,
      touch: 'ontouchstart' in window,
    });
  });
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', () => push('visibility', { state: document.visibilityState }));
  document.addEventListener('click', (e) => push('click', { x: e.clientX, y: e.clientY, btn: e.button }));
  document.addEventListener('mousemove', (() => {
    let last = 0;
    return (e) => {
      const now = Date.now();
      if (now - last > 500) {
        last = now;
        push('mousemove', { x: e.clientX, y: e.clientY });
      }
    };
  })());
  document.addEventListener('scroll', (() => {
    let last = 0;
    return () => {
      const now = Date.now();
      if (now - last > 500) {
        last = now;
        push('scroll', { x: window.scrollX, y: window.scrollY });
      }
    };
  })());
  document.addEventListener('keydown', (e) => push('keydown', { k: e.key }));

  setInterval(flush, 3000);
})();