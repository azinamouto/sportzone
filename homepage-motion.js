import { animate, motionValue, scroll, springValue } from 'motion';

// One court, three layers: document flow, scroll pose, then entrance/hover.
// Native scrolling drives a normalized spring value; no React render loop.
export function initHomepageMotion() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const compact = matchMedia('(max-width: 580px)');
  const tablet = matchMedia('(max-width: 1150px)');
  const hero = document.querySelector('.hero');
  const stage = document.querySelector('.court-stage');
  const pose = document.querySelector('.court-scroll');
  const entrance = document.querySelector('.court-entrance');
  const photo = document.querySelector('.hero-photo');
  const title = document.querySelector('.hero h1');
  const cards = [...document.querySelectorAll('.court-preview, .sport-card, .feature-item, .gallery-item, .location-info-card, .contact-summary-card')];
  const cleanups = [];
  let stopMotion = () => {};

  // SVG dimensions update only on layout changes, never during scrolling.
  const namespace = 'http://www.w3.org/2000/svg';
  cards.forEach(card => {
    card.classList.add('motion-card');
    const edge = document.createElementNS(namespace, 'svg');
    edge.classList.add('running-edge');
    edge.setAttribute('aria-hidden', 'true');
    edge.setAttribute('focusable', 'false');
    ['edge-trail', 'edge-pulse', 'edge-core'].forEach(name => {
      const rect = document.createElementNS(namespace, 'rect');
      rect.setAttribute('class', name);
      rect.setAttribute('pathLength', '100');
      edge.append(rect);
    });
    card.append(edge);
  });
  const sizeEdges = new ResizeObserver(entries => {
    entries.forEach(({ target }) => {
      const edge = target.querySelector('.running-edge');
      const width = target.offsetWidth;
      const height = target.offsetHeight;
      const radius = parseFloat(getComputedStyle(target).borderTopLeftRadius);
      edge.setAttribute('viewBox', `0 0 ${width} ${height}`);
      edge.querySelectorAll('rect').forEach(rect => {
        Object.entries({ x: 1, y: 1, width: Math.max(0, width - 2), height: Math.max(0, height - 2), rx: Math.max(0, radius - 1) })
          .forEach(([key, value]) => rect.setAttribute(key, String(value)));
      });
    });
  });
  cards.forEach(card => sizeEdges.observe(card));

  function startMotion() {
    stopMotion();
    if (reduced.matches) return;
    const disposers = [];
    const animations = [];
    const events = new AbortController();
    const source = motionValue(0);
    const progress = springValue(source, { stiffness: 170, damping: 25, mass: .7 });
    const mobile = compact.matches;
    const small = tablet.matches;
    const initial = mobile
      ? { x: 0, y: 22, scale: .035, rx: 2, ry: 0, rz: -1 }
      : small
        ? { x: -4, y: 62, scale: .11, rx: 7, ry: -6, rz: -3 }
        : { x: -16, y: 90, scale: .24, rx: 12, ry: -12, rz: -5 };
    const restAngle = mobile ? -3 : -5;
    function render(value) {
      // Spring may overshoot by a fraction: this is the final, restrained settle.
      const remaining = 1 - value;
      pose.style.transform = `perspective(${1000 + value * 800}px) translate3d(${initial.x * remaining}px,${initial.y * remaining}px,0) scale(${1 + initial.scale * remaining}) rotateX(${initial.rx * remaining}deg) rotateY(${initial.ry * remaining}deg) rotateZ(${restAngle + initial.rz * remaining}deg)`;
      pose.style.opacity = String(.94 + .06 * Math.min(1, Math.max(0, value)));
    }
    render(0);
    disposers.push(progress.on('change', render));
    let firstScroll = true;
    disposers.push(scroll(value => {
      source.set(value);
      // Restored scroll / deep links start in the correct pose immediately.
      if (firstScroll) { progress.jump(value); firstScroll = false; }
    }, { target: mobile ? stage : hero, offset: mobile ? ['start 95%', 'center 60%'] : ['start start', '0.2 start'] }));
    disposers.push(scroll(value => {
      photo.style.transform = `translate3d(0,${value * (mobile ? 22 : 65)}px,0) scale(${1.1 + value * .025})`;
      title.style.transform = `translate3d(0,${value * (mobile ? -5 : -14)}px,0)`;
      hero.style.setProperty('--ambient-y', `${value * -25}px`);
    }, { target: hero, offset: ['start start', 'end start'] }));

    const enter = (element, keyframes, options = {}) => {
      const animation = animate(element, keyframes, { duration: .8, ease: [.22, 1, .36, 1], ...options });
      animations.push(animation);
    };
    enter(entrance, { opacity: [0, 1], transform: ['scale(.94)', 'scale(1)'] }, { duration: 1, delay: .08 });
    document.querySelectorAll('.hero-line').forEach((line, index) => {
      enter(line, { opacity: [0, 1], transform: ['translateY(22px)', 'translateY(0)'] }, { delay: .1 + index * .11 });
    });
    title.classList.add('zone-emphasis');

    // Individual translate composes with the card's independent hover transform.
    const reveals = [...document.querySelectorAll('.section-heading, .section-subtitle, .about-description, .sport-card, .feature-item, .gallery-item, .location-info-card, .location-map-card, .contact-summary-card')];
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: .06, rootMargin: '0px 0px -24px 0px' });
    reveals.forEach(element => {
      const siblings = [...element.parentElement.children].filter(child => child.matches('.sport-card, .feature-item, .gallery-item'));
      element.style.setProperty('--reveal-delay', `${Math.max(0, siblings.indexOf(element)) % (mobile ? 1 : 4) * 65}ms`);
      element.classList.add('motion-reveal');
      observer.observe(element);
    });

    const resetTilt = card => {
      ['--tilt-x', '--tilt-y', '--shadow-x', '--shadow-y', '--shine-x', '--shine-y'].forEach(key => card.style.removeProperty(key));
      card.classList.remove('is-tilting');
    };
    let pointerFrame = 0;
    let pendingPointer;
    cards.forEach(card => {
      card.addEventListener('pointermove', event => {
        if (!fine.matches || event.pointerType !== 'mouse') return;
        pendingPointer = { card, x: event.clientX, y: event.clientY };
        if (pointerFrame) return;
        pointerFrame = requestAnimationFrame(() => {
          pointerFrame = 0;
          if (!pendingPointer) return;
          const { card: target, x, y } = pendingPointer;
          const rect = target.getBoundingClientRect();
          const px = Math.max(-.5, Math.min(.5, (x - rect.left) / rect.width - .5));
          const py = Math.max(-.5, Math.min(.5, (y - rect.top) / rect.height - .5));
          target.classList.add('is-tilting');
          Object.entries({ '--tilt-x': `${-py * 7}deg`, '--tilt-y': `${px * 7}deg`, '--shadow-x': `${-px * 10}px`, '--shadow-y': `${14 - py * 8}px`, '--shine-x': `${(px + .5) * 100}%`, '--shine-y': `${(py + .5) * 100}%` })
            .forEach(([key, value]) => target.style.setProperty(key, value));
        });
      }, { signal: events.signal, passive: true });
      const leave = () => { pendingPointer = null; resetTilt(card); };
      card.addEventListener('pointerleave', leave, { signal: events.signal });
      card.addEventListener('pointercancel', leave, { signal: events.signal });
    });
    stopMotion = () => {
      events.abort();
      cancelAnimationFrame(pointerFrame);
      observer.disconnect();
      disposers.forEach(dispose => dispose());
      progress.destroy();
      source.destroy();
      animations.forEach(animation => animation.cancel());
      cards.forEach(resetTilt);
      reveals.forEach(element => { element.classList.remove('motion-reveal', 'visible'); element.style.removeProperty('--reveal-delay'); });
      document.querySelectorAll('.hero-line').forEach(line => { line.style.removeProperty('opacity'); line.style.removeProperty('transform'); });
      [pose, entrance, photo, title].forEach(element => { element.style.removeProperty('transform'); element.style.removeProperty('opacity'); });
      title.classList.remove('zone-emphasis');
      hero.style.removeProperty('--ambient-y');
      stopMotion = () => {};
    };
  }
  [reduced, compact, tablet, fine].forEach(query => {
    query.addEventListener('change', startMotion);
    cleanups.push(() => query.removeEventListener('change', startMotion));
  });
  startMotion();
  // Keep BFCache navigation resumable; remove subscriptions on real teardown.
  const onPageHide = event => {
    stopMotion();
    if (!event.persisted) destroy();
  };
  const onPageShow = event => { if (event.persisted) startMotion(); };
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  function destroy() {
    stopMotion();
    sizeEdges.disconnect();
    cleanups.forEach(cleanup => cleanup());
    cards.forEach(card => { card.querySelector('.running-edge')?.remove(); card.classList.remove('motion-card'); });
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('pageshow', onPageShow);
  }
  if (import.meta.hot) import.meta.hot.dispose(destroy);
  return destroy;
}
