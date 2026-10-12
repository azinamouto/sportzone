document.addEventListener('DOMContentLoaded', () => {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const header = document.getElementById('header');
  const toggle = document.getElementById('mobile-toggle');
  const menu = document.getElementById('nav-menu');
  const dropdown = document.getElementById('contact-sport');
  const progress = document.querySelector('.scroll-progress');
  const hero = document.querySelector('.hero');
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
    const offset = Math.min(y, hero.offsetHeight);
    hero.style.setProperty('--parallax-y', motion.matches ? '0px' : `${offset * .22}px`);
    hero.style.setProperty('--card-y', motion.matches ? '0px' : `${-offset * .055}px`);
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

  if ('IntersectionObserver' in window && !motion.matches) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .08 });
    document.querySelectorAll('.section-heading, .feature-item, .sport-card, .location-grid, .gallery, .contact-layout').forEach(element => {
      element.classList.add('reveal');
      observer.observe(element);
    });
  }
  document.querySelectorAll('.gallery-item, .sport-card, .feature-item').forEach(card => {
    card.addEventListener('pointermove', event => {
      if (motion.matches || event.pointerType !== 'mouse') return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`);
      card.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.removeProperty('--mouse-x');
      card.style.removeProperty('--mouse-y');
    });
  });

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

  // The static site prepares an email; it never claims a reservation was sent.
  const form = document.getElementById('contact-form');
  const feedback = document.getElementById('form-feedback');
  const historyPanel = document.getElementById('recent-inquiries-container');
  const historyList = document.getElementById('recent-inquiries-list');
  const dateInput = document.getElementById('contact-date');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  dateInput.min = ['year', 'month', 'day'].map(type => today.find(part => part.type === type).value).join('-');
  const storageKey = 'sportszone_drafts';
  let drafts = [];
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(saved)) drafts = saved.filter(item => item && typeof item.sport === 'string' && typeof item.date === 'string').slice(0, 4);
  } catch { /* The form also works when browser storage is unavailable. */ }
  function renderDrafts() {
    historyList.replaceChildren();
    historyPanel.style.display = drafts.length ? 'block' : 'none';
    drafts.forEach(draft => {
      const row = document.createElement('div');
      row.className = 'inquiry-item';
      const sport = document.createElement('span');
      sport.className = 'inquiry-sport';
      sport.textContent = draft.sport;
      const date = document.createElement('span');
      date.className = 'inquiry-date';
      date.textContent = `Draft · ${draft.date}`;
      row.append(sport, date);
      historyList.append(row);
    });
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form));
    const subject = `Sports Zone inquiry — ${values.sport}`;
    const body = `Name: ${values.name.trim()}\nPhone: ${values.phone.trim()}\nEmail: ${values.email.trim()}\nSport: ${values.sport}\nPreferred date: ${values.date || 'Flexible'}\nPreferred time: ${values.time || 'Flexible'}\nDuration: ${values.duration} hour(s)\n\n${values.message.trim()}`;
    feedback.replaceChildren();
    const title = document.createElement('strong');
    title.textContent = 'Your inquiry is ready.';
    const note = document.createElement('p');
    note.textContent = 'Open your email app below and send the message to request availability. Your court is not reserved yet. You can also call +63 917 555 7768.';
    const send = document.createElement('a');
    send.className = 'btn';
    send.textContent = 'Open Email App ↗';
    send.href = `mailto:sportszone.talibon@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    feedback.append(title, note, send);
    feedback.className = 'form-feedback success';
    feedback.scrollIntoView({ behavior: motion.matches ? 'instant' : 'smooth', block: 'nearest' });
    drafts.unshift({ sport: values.sport, date: values.date || 'Flexible' });
    drafts = drafts.slice(0, 4);
    try { localStorage.setItem(storageKey, JSON.stringify(drafts)); } catch { /* Draft history is optional. */ }
    renderDrafts();
  });
  document.getElementById('clear-inquiries-btn').addEventListener('click', () => {
    drafts = [];
    try { localStorage.removeItem(storageKey); } catch { /* Clear the in-memory view regardless. */ }
    renderDrafts();
  });
  renderDrafts();

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
