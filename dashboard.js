// Sports Zone Admin Dashboard Client Logic
// Refined, compact SaaS layout with unclipped floating actions and responsive mobile cards

document.addEventListener('DOMContentLoaded', () => {
  const loginView = document.getElementById('login-view');
  const dashboardView = document.getElementById('dashboard-view');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const logoutBtn = document.getElementById('logout-btn');
  const authNavItems = document.querySelectorAll('.auth-only-nav');
  const userLabel = document.getElementById('nav-user-label');

  const tbody = document.getElementById('requests-tbody');
  const cardsContainer = document.getElementById('requests-cards');
  const searchInput = document.getElementById('search-input');
  const filterSport = document.getElementById('filter-sport');
  const sortSelect = document.getElementById('sort-select');
  const refreshBtn = document.getElementById('refresh-btn');
  const countLabel = document.getElementById('table-count-label');
  const footerSummary = document.getElementById('footer-summary-text');
  const storageBadge = document.getElementById('storage-status-badge');

  // Floating Action Menu
  const floatingMenu = document.getElementById('floating-menu');
  const menuOptConfirm = document.getElementById('menu-opt-confirm');
  const menuOptAssign = document.getElementById('menu-opt-assign');
  const menuOptComplete = document.getElementById('menu-opt-complete');
  const menuOptReject = document.getElementById('menu-opt-reject');
  const menuOptDelete = document.getElementById('menu-opt-delete');
  let activeMenuRequest = null;
  let activeTriggerButton = null;

  // Status Tabs
  const statusTabs = document.querySelectorAll('.dash-tab');
  let currentActiveTab = 'all';

  // Stats elements
  const statTotal = document.getElementById('stat-total');
  const statPending = document.getElementById('stat-pending');
  const statConfirmed = document.getElementById('stat-confirmed');
  const statToday = document.getElementById('stat-today');
  const tabCountAll = document.getElementById('tab-count-all');
  const tabCountPending = document.getElementById('tab-count-pending');
  const tabCountConfirmed = document.getElementById('tab-count-confirmed');
  const tabCountCompleted = document.getElementById('tab-count-completed');
  const tabCountRejected = document.getElementById('tab-count-rejected');

  // New Request Modal
  const newModal = document.getElementById('new-request-modal');
  const openNewNav = document.getElementById('open-new-modal-nav');
  const openNewBtn = document.getElementById('open-new-modal-btn');
  const closeNewBtn = document.getElementById('close-new-modal');
  const cancelNewBtn = document.getElementById('cancel-new-modal');
  const newForm = document.getElementById('dash-new-form');

  // Assign Modal
  const assignModal = document.getElementById('assign-modal');
  const closeAssignBtn = document.getElementById('close-assign-modal');
  const cancelAssignBtn = document.getElementById('cancel-assign-modal');
  const assignForm = document.getElementById('dash-assign-form');
  const assignReqId = document.getElementById('assign-req-id');
  const assignStatus = document.getElementById('assign-status');
  const assignCourt = document.getElementById('assign-court');
  const assignNotes = document.getElementById('assign-notes');
  const assignTitle = document.getElementById('assign-modal-title');

  // Detail Modal
  const detailModal = document.getElementById('detail-modal');
  const closeDetailBtn = document.getElementById('close-detail-modal');
  const detailRefId = document.getElementById('detail-ref-id');
  const detailStatusBadge = document.getElementById('detail-status-badge');
  const detailName = document.getElementById('detail-name');
  const detailPhone = document.getElementById('detail-phone');
  const detailEmail = document.getElementById('detail-email');
  const detailSport = document.getElementById('detail-sport');
  const detailSchedule = document.getElementById('detail-schedule');
  const detailPrice = document.getElementById('detail-price');
  const detailMessage = document.getElementById('detail-message');
  const detailCourt = document.getElementById('detail-court');
  const detailNotes = document.getElementById('detail-notes');
  const detailBtnConfirm = document.getElementById('detail-btn-confirm');
  const detailBtnAssign = document.getElementById('detail-btn-assign');
  const detailBtnComplete = document.getElementById('detail-btn-complete');
  const detailBtnReject = document.getElementById('detail-btn-reject');
  let activeDetailRequest = null;

  let allRequests = [];

  function getToken() {
    return localStorage.getItem('sz_admin_token') || '';
  }

  function setToken(token) {
    if (token) localStorage.setItem('sz_admin_token', token);
    else localStorage.removeItem('sz_admin_token');
  }

  function getAuthHeaders() {
    const token = getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };
  }

  function updateView(isAuthenticated, user) {
    if (isAuthenticated) {
      loginView.style.display = 'none';
      dashboardView.style.display = 'block';
      authNavItems.forEach(el => el.style.display = el.classList.contains('nav-cta-item') ? 'block' : 'inline-flex');
      if (userLabel && user?.email) {
        userLabel.innerHTML = `<span>👤</span> ${escapeHtml(user.email)}`;
      }
    } else {
      loginView.style.display = 'flex';
      dashboardView.style.display = 'none';
      authNavItems.forEach(el => el.style.display = 'none');
      closeFloatingMenu();
    }
  }

  async function checkAuth() {
    const token = getToken();
    if (!token) {
      updateView(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/me', { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success && json.authenticated) {
        updateView(true, json.user);
        loadStats();
        loadRequests();
      } else {
        setToken('');
        updateView(false);
      }
    } catch {
      updateView(false);
    }
  }

  // Login handler
  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    loginError.style.display = 'none';
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const submitBtn = document.getElementById('login-submit-btn');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying credentials...';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();

      if (res.ok && json.success && json.token) {
        setToken(json.token);
        updateView(true, json.user);
        await Promise.all([loadStats(), loadRequests()]);
      } else {
        loginError.textContent = json.message || (res.status === 401
          ? 'Invalid email or password.'
          : 'Authentication service unavailable. Please try again later.');
        loginError.style.display = 'block';
      }
    } catch {
      loginError.textContent = 'Network error connecting to auth service.';
      loginError.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Access Dashboard ↗';
    }
  });

  // Logout handler
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST', headers: getAuthHeaders() });
      } catch { /* Ignore */ }
      setToken('');
      updateView(false);
    });
  }

  // Status Tab Clicks
  statusTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      statusTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentActiveTab = tab.dataset.tab;
      closeFloatingMenu();
      renderUI();
    });
  });

  async function loadStats() {
    try {
      const res = await fetch('/api/stats', { headers: getAuthHeaders() });
      if (res.status === 401) {
        setToken('');
        updateView(false);
        return;
      }
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        statTotal.textContent = d.total || 0;
        statPending.textContent = d.pending || 0;
        statConfirmed.textContent = d.confirmed || 0;
        statToday.textContent = d.todayCount || 0;

        tabCountAll.textContent = d.total || 0;
        tabCountPending.textContent = d.pending || 0;
        tabCountConfirmed.textContent = d.confirmed || 0;
        tabCountCompleted.textContent = d.completed || 0;
        tabCountRejected.textContent = d.rejected || 0;

        if (d.isSupabaseActive) {
          storageBadge.className = 'storage-status-tag active';
          storageBadge.innerHTML = '<span class="status-dot" style="background:#10b981;"></span> Supabase Cloud Active';
        } else {
          storageBadge.className = 'storage-status-tag';
          storageBadge.innerHTML = '<span class="status-dot" style="background:#3b82f6;"></span> Server Persistent Store';
        }
      }
    } catch (err) {
      console.warn('Failed to fetch stats:', err);
    }
  }

  function getInitials(name) {
    if (!name) return 'SZ';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  function getSportEmoji(sport) {
    if (!sport) return '⚡';
    if (sport.includes('Basket')) return '🏀';
    if (sport.includes('Badmin')) return '🏸';
    if (sport.includes('Volley')) return '🏐';
    if (sport.includes('Pickle')) return '🏓';
    return '⚡';
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'Flexible';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  function formatTime(timeStr) {
    if (!timeStr) return 'Flexible';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    let hour = parseInt(parts[0], 10);
    const minute = parts[1];
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${ampm}`;
  }

  async function loadRequests() {
    closeFloatingMenu();
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2.5rem; color:var(--dash-muted);">Fetching requests from database...</td></tr>`;
    if (cardsContainer) cardsContainer.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--dash-muted);">Loading...</div>`;

    try {
      const res = await fetch('/api/requests', { headers: getAuthHeaders() });
      if (res.status === 401) {
        setToken('');
        updateView(false);
        return;
      }

      const json = await res.json();
      if (!json.success || !Array.isArray(json.data)) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:#ef4444;">Failed to load data from API</td></tr>`;
        return;
      }

      allRequests = json.data;
      renderUI();
    } catch (err) {
      console.error('loadRequests error:', err);
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:#ef4444;">Network error connecting to /api/requests</td></tr>`;
    }
  }

  function getFilteredRequests() {
    let filtered = [...allRequests];

    // Filter by Tab
    if (currentActiveTab !== 'all') {
      filtered = filtered.filter(r => r.status === currentActiveTab);
    }

    // Filter by Sport
    const selectedSport = filterSport.value;
    if (selectedSport && selectedSport !== 'all') {
      filtered = filtered.filter(r => r.sport.toLowerCase() === selectedSport.toLowerCase());
    }

    // Search query
    const query = searchInput.value.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter(r =>
        r.name.toLowerCase().includes(query) ||
        r.phone.toLowerCase().includes(query) ||
        (r.email && r.email.toLowerCase().includes(query)) ||
        r.id.toLowerCase().includes(query) ||
        r.sport.toLowerCase().includes(query) ||
        (r.court_assigned && r.court_assigned.toLowerCase().includes(query)) ||
        (r.message && r.message.toLowerCase().includes(query))
      );
    }

    // Sort
    const sortVal = sortSelect.value;
    if (sortVal === 'newest') {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortVal === 'oldest') {
      filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (sortVal === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortVal === 'sport') {
      filtered.sort((a, b) => a.sport.localeCompare(b.sport));
    }

    return filtered;
  }

  function renderUI() {
    closeFloatingMenu();
    const filtered = getFilteredRequests();

    countLabel.textContent = `Showing ${filtered.length} of ${allRequests.length} requests`;
    footerSummary.textContent = `Displaying ${filtered.length} inquiries · Filter: ${currentActiveTab.toUpperCase()}`;

    renderTable(filtered);
    renderMobileCards(filtered);
  }

  function renderTable(filtered) {
    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding:3rem 1rem;">
            <div style="font-size: 1.8rem; margin-bottom: 0.35rem;">📋</div>
            <div style="font-weight: 700; font-size: 0.95rem; color: var(--dash-text);">No matching inquiries</div>
            <div style="font-size: 0.8rem; color: var(--dash-muted); margin-top: 0.2rem;">
              No booking requests match your current filters.
            </div>
            <button id="reset-filters-btn" class="btn btn-secondary btn-sm" style="margin-top: 0.85rem; min-height: 32px; padding: 0 0.85rem;" type="button">
              Clear Filters
            </button>
          </td>
        </tr>
      `;
      const resetBtn = document.getElementById('reset-filters-btn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          searchInput.value = '';
          filterSport.value = 'all';
          currentActiveTab = 'all';
          statusTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'all'));
          renderUI();
        });
      }
      return;
    }

    tbody.innerHTML = filtered.map(req => {
      const sportEmoji = getSportEmoji(req.sport);
      const initials = getInitials(req.name);
      const formattedDate = formatDate(req.date);
      const formattedTime = formatTime(req.time);
      const submissionDate = new Date(req.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      const status = req.status || 'pending';
      const statusClass = `badge-${status}`;

      return `
        <tr data-id="${req.id}">
          <!-- 1. Ref ID -->
          <td>
            <span class="ref-id-tag" title="Reference Identifier">${escapeHtml(req.id)}</span>
            <div class="ref-sub-date">${submissionDate}</div>
          </td>

          <!-- 2. Customer -->
          <td>
            <div class="customer-cell">
              <div class="customer-avatar" title="${escapeHtml(req.name)}">${initials}</div>
              <div class="customer-info">
                <div class="customer-name" title="${escapeHtml(req.name)}">${escapeHtml(req.name)}</div>
                <div class="customer-sub">
                  <a href="tel:${escapeHtml(req.phone)}" title="Direct Phone">📞 ${escapeHtml(req.phone)}</a>
                  ${req.email ? `<span style="opacity: 0.4;">·</span><a href="mailto:${escapeHtml(req.email)}" title="${escapeHtml(req.email)}">✉️</a>` : ''}
                </div>
              </div>
            </div>
          </td>

          <!-- 3. Sport -->
          <td>
            <span class="badge-sport">
              <span>${sportEmoji}</span>
              <span>${escapeHtml(req.sport)}</span>
            </span>
          </td>

          <!-- 4. Schedule -->
          <td>
            <div class="schedule-main">${formattedDate}</div>
            <div class="schedule-sub">${formattedTime} · ${req.duration || 1}h</div>
          </td>

          <!-- 5. Rate / Est. Fee -->
          <td>
            <div class="fee-amount">₱${req.estimated_price ? req.estimated_price.toLocaleString() : '—'}</div>
            <div class="fee-sub">est. fee</div>
          </td>

          <!-- 6. Status -->
          <td>
            <span class="badge-status ${statusClass}">
              ${status.toUpperCase()}
            </span>
          </td>

          <!-- 7. Court & Notes -->
          <td>
            ${req.court_assigned ? `<div class="court-tag">📍 ${escapeHtml(req.court_assigned)}</div>` : `<span class="court-empty">Unassigned</span>`}
            ${req.message ? `<div class="note-preview-line" title="Customer message: ${escapeHtml(req.message)}">💬 ${escapeHtml(req.message)}</div>` : ''}
            ${req.admin_notes ? `<div class="note-preview-line" style="color:var(--dash-muted);" title="Staff note: ${escapeHtml(req.admin_notes)}">📝 ${escapeHtml(req.admin_notes)}</div>` : ''}
          </td>

          <!-- 8. Compact SaaS Actions Column -->
          <td style="text-align: right;">
            <div class="actions-cell-wrap">
              <button class="btn-action-view" data-action="view" data-id="${req.id}" title="View all details">
                View
              </button>
              <button class="btn-action-menu-trigger" data-action="menu-trigger" data-id="${req.id}" aria-label="More actions">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="19" r="2.2"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderMobileCards(filtered) {
    if (!cardsContainer) return;

    if (filtered.length === 0) {
      cardsContainer.innerHTML = '';
      return;
    }

    cardsContainer.innerHTML = filtered.map(req => {
      const sportEmoji = getSportEmoji(req.sport);
      const initials = getInitials(req.name);
      const formattedDate = formatDate(req.date);
      const formattedTime = formatTime(req.time);
      const status = req.status || 'pending';
      const statusClass = `badge-${status}`;

      return `
        <div class="mobile-req-card" data-id="${req.id}">
          <div class="mobile-card-top">
            <span class="ref-id-tag">${escapeHtml(req.id)}</span>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="badge-status ${statusClass}">${status.toUpperCase()}</span>
              <button class="btn-action-menu-trigger" data-action="menu-trigger" data-id="${req.id}" aria-label="More actions">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="19" r="2.2"/></svg>
              </button>
            </div>
          </div>

          <div class="mobile-card-customer">
            <div class="customer-avatar">${initials}</div>
            <div>
              <div class="customer-name" style="font-size: 0.95rem;">${escapeHtml(req.name)}</div>
              <div class="customer-sub" style="font-size: 0.8rem;">
                <a href="tel:${escapeHtml(req.phone)}">📞 ${escapeHtml(req.phone)}</a>
                ${req.email ? ` · <a href="mailto:${escapeHtml(req.email)}">✉️ ${escapeHtml(req.email)}</a>` : ''}
              </div>
            </div>
          </div>

          <div class="mobile-card-details-grid">
            <div>
              <div class="dash-stat-label">Sport</div>
              <span class="badge-sport" style="margin-top: 0.15rem;">
                <span>${sportEmoji}</span>
                <span>${escapeHtml(req.sport)}</span>
              </span>
            </div>
            <div>
              <div class="dash-stat-label">Est. Fee</div>
              <div class="fee-amount" style="margin-top: 0.15rem;">₱${req.estimated_price ? req.estimated_price.toLocaleString() : '—'}</div>
            </div>
            <div>
              <div class="dash-stat-label">Schedule</div>
              <div style="font-weight: 600; color: var(--dash-text); margin-top: 0.15rem;">${formattedDate}</div>
              <div style="color: var(--dash-muted); font-size: 0.72rem;">${formattedTime} (${req.duration || 1}h)</div>
            </div>
            <div>
              <div class="dash-stat-label">Court</div>
              <div style="margin-top: 0.15rem;">
                ${req.court_assigned ? `<span class="court-tag">📍 ${escapeHtml(req.court_assigned)}</span>` : `<span class="court-empty">Unassigned</span>`}
              </div>
            </div>
          </div>

          ${req.message ? `
            <div style="font-size: 0.78rem; color: var(--dash-muted); margin-bottom: 0.75rem; background: rgba(255,255,255,0.02); padding: 0.5rem 0.65rem; border-radius: 6px;">
              💬 "${escapeHtml(req.message)}"
            </div>
          ` : ''}

          <div class="mobile-card-actions">
            <button class="btn btn-secondary btn-sm" data-action="view" data-id="${req.id}" type="button">
              View Details
            </button>
            ${status !== 'confirmed' ? `
              <button class="btn btn-sm" data-action="quick-confirm" data-id="${req.id}" style="background:#10b981; color:white;" type="button">
                ✓ Confirm
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Floating Action Menu Management (Zero clipping guarantee)
  function openFloatingMenu(button, req) {
    activeDetailRequest = req;
    activeMenuRequest = req;
    if (activeTriggerButton) activeTriggerButton.classList.remove('active');
    activeTriggerButton = button;
    button.classList.add('active');

    // Update menu option states based on request status
    menuOptConfirm.style.display = req.status === 'confirmed' ? 'none' : 'flex';
    menuOptComplete.style.display = req.status === 'completed' ? 'none' : 'flex';
    menuOptReject.style.display = req.status === 'rejected' ? 'none' : 'flex';

    // Calculate fixed viewport position
    const rect = button.getBoundingClientRect();
    const menuWidth = 190;
    const menuHeight = 180;

    let left = rect.right - menuWidth;
    if (left < 10) left = 10;

    let top = rect.bottom + 6;
    // Auto-flip upward if too close to bottom edge of window
    if (top + menuHeight > window.innerHeight && rect.top > menuHeight) {
      top = rect.top - menuHeight - 6;
    }

    floatingMenu.style.top = `${Math.round(top)}px`;
    floatingMenu.style.left = `${Math.round(left)}px`;
    floatingMenu.classList.add('open');
  }

  function closeFloatingMenu() {
    floatingMenu.classList.remove('open');
    if (activeTriggerButton) {
      activeTriggerButton.classList.remove('active');
      activeTriggerButton = null;
    }
  }

  // Close floating menu on document clicks outside or scroll
  document.addEventListener('click', event => {
    if (!floatingMenu.contains(event.target) && !event.target.closest('.btn-action-menu-trigger')) {
      closeFloatingMenu();
    }
  });

  window.addEventListener('scroll', closeFloatingMenu, { passive: true });
  window.addEventListener('resize', closeFloatingMenu);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeFloatingMenu();
  });

  // Floating Menu Actions
  menuOptConfirm.addEventListener('click', async () => {
    if (!activeMenuRequest) return;
    const req = activeMenuRequest;
    closeFloatingMenu();
    await updateStatus(req.id, 'confirmed');
  });

  menuOptComplete.addEventListener('click', async () => {
    if (!activeMenuRequest) return;
    const req = activeMenuRequest;
    closeFloatingMenu();
    await updateStatus(req.id, 'completed');
  });

  menuOptAssign.addEventListener('click', () => {
    if (!activeMenuRequest) return;
    const req = activeMenuRequest;
    closeFloatingMenu();
    openAssignModal(req);
  });

  menuOptReject.addEventListener('click', async () => {
    if (!activeMenuRequest) return;
    const req = activeMenuRequest;
    closeFloatingMenu();
    if (confirm(`Decline booking inquiry for ${req.name} (${req.sport})?`)) {
      await updateStatus(req.id, 'rejected');
    }
  });

  menuOptDelete.addEventListener('click', async () => {
    if (!activeMenuRequest) return;
    const req = activeMenuRequest;
    closeFloatingMenu();
    if (confirm(`Are you sure you want to delete inquiry ${req.id} for ${req.name}? This operation is permanent.`)) {
      await deleteRequest(req.id);
    }
  });

  // Open Detail Modal
  function openDetailModal(req) {
    activeDetailRequest = req;
    closeFloatingMenu();

    detailRefId.textContent = req.id;
    detailStatusBadge.className = `badge-status badge-${req.status || 'pending'}`;
    detailStatusBadge.textContent = (req.status || 'PENDING').toUpperCase();

    detailName.textContent = req.name;
    detailPhone.textContent = `📞 ${req.phone}`;
    detailEmail.textContent = req.email ? `✉️ ${req.email}` : 'No email provided';

    detailSport.textContent = `${getSportEmoji(req.sport)} ${req.sport}`;
    detailSchedule.textContent = `📅 ${formatDate(req.date)} · ${formatTime(req.time)} (${req.duration || 1}h)`;
    detailPrice.textContent = req.estimated_price ? `Estimated Price: ₱${req.estimated_price.toLocaleString()}` : 'Custom rate';

    detailMessage.textContent = req.message || 'No additional note provided by customer.';
    detailCourt.textContent = req.court_assigned ? `📍 Court Allocated: ${req.court_assigned}` : '📍 Court: Not yet assigned';
    detailNotes.textContent = req.admin_notes ? `📝 Staff Note: ${req.admin_notes}` : '📝 Staff Note: None';

    detailBtnConfirm.style.display = req.status === 'confirmed' ? 'none' : 'inline-flex';
    detailBtnReject.style.display = req.status === 'rejected' ? 'none' : 'inline-flex';
    detailBtnComplete.style.display = req.status === 'completed' ? 'none' : 'inline-flex';

    detailModal.classList.add('open');
  }

  function openAssignModal(req) {
    assignReqId.value = req.id;
    assignStatus.value = req.status;
    assignCourt.value = req.court_assigned || '';
    assignNotes.value = req.admin_notes || '';
    assignTitle.textContent = `Court Assignment · ${req.id}`;
    assignModal.classList.add('open');
  }

  if (closeDetailBtn) {
    closeDetailBtn.addEventListener('click', () => detailModal.classList.remove('open'));
  }

  // Detail Modal Actions
  detailBtnConfirm.addEventListener('click', async () => {
    if (!activeDetailRequest) return;
    await updateStatus(activeDetailRequest.id, 'confirmed');
    detailModal.classList.remove('open');
  });

  detailBtnReject.addEventListener('click', async () => {
    if (!activeDetailRequest) return;
    if (confirm(`Decline booking request for ${activeDetailRequest.name}?`)) {
      await updateStatus(activeDetailRequest.id, 'rejected');
      detailModal.classList.remove('open');
    }
  });

  detailBtnComplete.addEventListener('click', async () => {
    if (!activeDetailRequest) return;
    await updateStatus(activeDetailRequest.id, 'completed');
    detailModal.classList.remove('open');
  });

  detailBtnAssign.addEventListener('click', () => {
    if (!activeDetailRequest) return;
    const req = activeDetailRequest;
    detailModal.classList.remove('open');
    openAssignModal(req);
  });

  // Event Delegation for Table & Cards
  document.addEventListener('click', async event => {
    // Menu trigger
    const menuTrigger = event.target.closest('[data-action="menu-trigger"]');
    if (menuTrigger) {
      event.stopPropagation();
      const id = menuTrigger.dataset.id;
      const req = allRequests.find(r => r.id === id);
      if (req) {
        if (floatingMenu.classList.contains('open') && activeTriggerButton === menuTrigger) {
          closeFloatingMenu();
        } else {
          openFloatingMenu(menuTrigger, req);
        }
      }
      return;
    }

    // View button
    const viewBtn = event.target.closest('[data-action="view"]');
    if (viewBtn) {
      const id = viewBtn.dataset.id;
      const req = allRequests.find(r => r.id === id);
      if (req) openDetailModal(req);
      return;
    }

    // Quick confirm on mobile
    const quickConfirm = event.target.closest('[data-action="quick-confirm"]');
    if (quickConfirm) {
      const id = quickConfirm.dataset.id;
      await updateStatus(id, 'confirmed');
      return;
    }
  });

  async function updateStatus(id, status) {
    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (json.success) {
        await Promise.all([loadRequests(), loadStats()]);
      } else {
        alert(json.message || 'Failed to update status');
      }
    } catch {
      alert('Error communicating with backend API');
    }
  }

  async function deleteRequest(id) {
    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (json.success) {
        await Promise.all([loadRequests(), loadStats()]);
      } else {
        alert(json.message || 'Failed to delete request');
      }
    } catch {
      alert('Error communicating with backend API');
    }
  }

  // Assign Modal Submission
  assignForm.addEventListener('submit', async event => {
    event.preventDefault();
    const id = assignReqId.value;
    const payload = {
      status: assignStatus.value,
      court_assigned: assignCourt.value.trim(),
      admin_notes: assignNotes.value.trim(),
    };

    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        assignModal.classList.remove('open');
        await Promise.all([loadRequests(), loadStats()]);
      } else {
        alert(json.message || 'Update failed');
      }
    } catch {
      alert('Error updating court assignment');
    }
  });

  closeAssignBtn.addEventListener('click', () => assignModal.classList.remove('open'));
  cancelAssignBtn.addEventListener('click', () => assignModal.classList.remove('open'));

  // New Request Modal Handlers
  const openNew = () => {
    newForm.reset();
    newModal.classList.add('open');
  };
  const closeNew = () => newModal.classList.remove('open');

  if (openNewNav) openNewNav.addEventListener('click', openNew);
  if (openNewBtn) openNewBtn.addEventListener('click', openNew);
  if (closeNewBtn) closeNewBtn.addEventListener('click', closeNew);
  if (cancelNewBtn) cancelNewBtn.addEventListener('click', closeNew);

  newForm.addEventListener('submit', async event => {
    event.preventDefault();
    const formData = new FormData(newForm);
    const payload = Object.fromEntries(formData);

    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        closeNew();
        await Promise.all([loadRequests(), loadStats()]);
      } else {
        alert(json.message || 'Failed to create request');
      }
    } catch {
      alert('Error saving booking request');
    }
  });

  // Search & Filter Events
  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderUI, 120);
  });

  filterSport.addEventListener('change', renderUI);
  sortSelect.addEventListener('change', renderUI);
  refreshBtn.addEventListener('click', () => {
    loadRequests();
    loadStats();
  });

  // Table header sorting
  document.querySelectorAll('.dash-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const sortKey = th.dataset.sort;
      if (sortKey === 'id') sortSelect.value = sortSelect.value === 'newest' ? 'oldest' : 'newest';
      else if (sortKey === 'name') sortSelect.value = 'name';
      else if (sortKey === 'sport') sortSelect.value = 'sport';
      renderUI();
    });
  });

  // Check auth and initialize
  checkAuth();
});
