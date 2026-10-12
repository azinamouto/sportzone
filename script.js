import { createReceiptTracker } from './receipt.js';
import { initHomepageMotion } from './homepage-motion.js';

document.addEventListener('DOMContentLoaded', () => {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const header = document.getElementById('header');
  const toggle = document.getElementById('mobile-toggle');
  const menu = document.getElementById('nav-menu');
  const dropdown = document.getElementById('contact-sport');
  const progress = document.querySelector('.scroll-progress');
  initHomepageMotion();
  const sections = [...document.querySelectorAll('section[id]')];
  const navLinks = [...document.querySelectorAll('.nav-link')];
  const closeMenu = () => {
    menu.classList.remove('open');
    toggle.classList.remove('active');
    toggle.setAttribute('aria-expanded', 'false');
  };
  toggle.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    toggle.classList.toggle('active', open);
    toggle.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.classList.contains('open')) {
      closeMenu();
      toggle.focus();
    }
  });
  document.addEventListener('click', event => {
    if (!header.contains(event.target)) closeMenu();
  });
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  window.matchMedia('(min-width: 851px)').addEventListener('change', closeMenu);

  // A single scheduled frame handles all scroll effects; no animation loop at rest.
  let scheduled = false;
  function updateScroll() {
    const y = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${maxScroll > 0 ? y / maxScroll : 0})`;
    let current = 'home';
    sections.forEach(section => {
      if (section.getBoundingClientRect().top <= header.offsetHeight + 110) current = section.id;
    });
    navLinks.forEach(link => {
      const active = link.hash === `#${current}`;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    scheduled = false;
  }
  function scheduleScroll() {
    if (!scheduled) { scheduled = true; requestAnimationFrame(updateScroll); }
  }
  window.addEventListener('scroll', scheduleScroll, { passive: true });
  window.addEventListener('resize', scheduleScroll);
  motion.addEventListener('change', scheduleScroll);
  updateScroll();

  function chooseSport(sport) {
    dropdown.value = sport;
    dropdown.dispatchEvent(new Event('change'));
    document.getElementById('contact').scrollIntoView({ behavior: motion.matches ? 'instant' : 'smooth' });
    dropdown.focus({ preventScroll: true });
  }
  document.querySelectorAll('.select-sport-btn').forEach(button => {
    button.addEventListener('click', () => chooseSport(button.dataset.sport));
  });
  const specs = {
    Basketball: ['Full and half court layouts with shock-absorbing flooring, breakaway rims, and LED lighting for evening games.', '₱250 – ₱400 / hour'],
    Badminton: ['Two regulation vinyl courts with anti-glare lighting. Rackets and shuttlecocks are available to rent.', '₱180 – ₱300 / hour'],
    Volleyball: ['Indoor court with adjustable net heights for men, women, and mixed tournaments, plus safety boundary margins.', '₱200 – ₱350 / hour'],
    Pickleball: ['Non-slip playing surface, regulation net, and marked kitchen zone. Rental paddles and balls available.', '₱150 – ₱250 / hour']
  };
  const gallery = [...document.querySelectorAll('.gallery-item')];
  const info = document.getElementById('sport-info-box');
  let selectedCard = null;
  function openSpecs(card) {
    selectedCard = card;
    gallery.forEach(item => {
      item.classList.toggle('selected', item === card);
      item.setAttribute('aria-expanded', String(item === card));
    });
    const sport = card.dataset.sport;
    document.getElementById('info-box-title').textContent = `${sport} Court`;
    document.getElementById('info-box-desc').textContent = specs[sport][0];
    document.getElementById('info-box-rate').textContent = specs[sport][1];
    info.style.display = 'block';
  }
  gallery.forEach(card => {
    card.addEventListener('click', () => openSpecs(card));
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openSpecs(card); }
    });
  });
  document.getElementById('info-box-close').addEventListener('click', () => {
    info.style.display = 'none';
    gallery.forEach(card => { card.classList.remove('selected'); card.setAttribute('aria-expanded', 'false'); });
    selectedCard?.focus({ preventScroll: true });
  });
  document.getElementById('info-box-book-btn').addEventListener('click', () => {
    if (selectedCard) chooseSport(selectedCard.dataset.sport);
  });

  const form = document.getElementById('contact-form');
  const feedback = document.getElementById('form-feedback');
  const tracker = createReceiptTracker();
  const dateInput = document.getElementById('contact-date');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  dateInput.min = ['year', 'month', 'day'].map(type => today.find(part => part.type === type).value).join('-');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form));
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    feedback.replaceChildren();
    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json();
      if (!response.ok || !result.success || !result.data || !result.tracking_token) {
        throw new Error('Submission failed');
      }
      tracker.add(result.data, result.tracking_token);
      form.reset();
      updateSession();
    } catch {
      feedback.textContent = 'Unable to confirm submission. Please contact us before trying again.';
      feedback.className = 'form-feedback';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send inquiry ↗';
    }
  });
  // Filters retain ordinary buttons and expose the selected state to assistive tech.
  const filters = [...document.querySelectorAll('[data-filter]')];
  const courts = [...document.querySelectorAll('.sport-card')];
  filters.forEach(button => button.addEventListener('click', () => {
    filters.forEach(item => {
      const selected = item === button;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    courts.forEach(card => {
      card.hidden = button.dataset.filter !== 'All courts' && card.querySelector('h3').textContent !== button.dataset.filter;
      if (!card.hidden) card.classList.add('visible');
    });
    document.getElementById('filter-status').textContent = button.dataset.filter === 'All courts' ? 'Showing all four courts.' : `Showing ${button.dataset.filter}.`;
  }));

  const rates = { Basketball: [250, 400], Badminton: [180, 300], Volleyball: [200, 350], Pickleball: [150, 250] };
  const duration = document.getElementById('contact-duration');
  const time = document.getElementById('contact-time');
  function updateSession() {
    const sport = dropdown.value;
    const hours = Number(duration.value);
    const range = rates[sport];
    document.getElementById('session-sport').textContent = sport || 'Choose your court';
    const parts = [`${hours} ${hours === 1 ? 'hour' : 'hours'}`];
    if (dateInput.value) {
      const date = new Date(`${dateInput.value}T12:00:00`);
      parts.push(date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }));
    }
    if (time.value) parts.push(time.value);
    document.getElementById('session-detail').textContent = sport ? parts.join(' · ') : 'Select a sport and duration to see an estimate.';
    document.getElementById('session-price').textContent = range ? `₱${(range[0] * hours).toLocaleString('en-PH')} – ₱${(range[1] * hours).toLocaleString('en-PH')}` : 'Let’s make time to play.';
  }
  [dropdown, duration, dateInput, time].forEach(input => input.addEventListener('change', updateSession));
  updateSession();
  // Stale prepared messages are removed as soon as the visitor edits their inquiry.
  form.addEventListener('input', () => {
    feedback.replaceChildren();
    feedback.className = 'form-feedback';
  });
});
