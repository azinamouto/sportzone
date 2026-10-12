// A compact receipt uses the site's type and palette. Status, slot and a saved
// private link are the only customer details; internal notes stay on the server.
export function createReceiptTracker() {
  const panel = document.getElementById('inquiry-receipt');
  const content = document.getElementById('receipt-content');
  const notice = document.getElementById('receipt-notice');
  const history = document.getElementById('recent-inquiries-list');
  const historyPanel = document.getElementById('recent-inquiries-container');
  const refresh = document.getElementById('receipt-refresh');
  const copy = document.getElementById('receipt-copy');
  const key = 'sportszone_receipts';
  const labels = { pending: 'Pending', confirmed: 'Confirmed', rejected: 'Declined', completed: 'Completed' };
  const messages = {
    pending: 'Waiting for the team to confirm your request.',
    confirmed: 'Your court request is confirmed.',
    rejected: 'Your request was declined. Contact us for another slot.',
    completed: 'Your booking is complete.',
  };
  let receipts = [];
  let activeId;
  let checking = false;
  const errors = new Map();
  let contentSignature = '';
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    if (Array.isArray(saved)) receipts = saved.filter(item => item &&
      typeof item.id === 'string' && /^[a-f0-9]{64}$/.test(item.token) &&
      (!item.status || Object.hasOwn(labels, item.status))).slice(0, 4);
  } catch { /* Private links also work without local storage. */ }

  function persist() {
    try { localStorage.setItem(key, JSON.stringify(receipts)); } catch { /* Optional history. */ }
  }
  function linkFor(receipt) {
    return `${location.origin}${location.pathname}#receipt=${encodeURIComponent(receipt.id)}.${receipt.token}`;
  }
  function render() {
    const receipt = receipts.find(item => item.id === activeId);
    panel.hidden = !receipt;
    historyPanel.hidden = receipts.length < 2;
    const existingButtons = new Map([...history.children].map(button => [button.dataset.receiptId, button]));
    for (const [id, button] of existingButtons) {
      if (!receipts.some(item => item.id === id)) button.remove();
    }
    receipts.forEach(item => {
      let button = existingButtons.get(item.id);
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'receipt-history-item';
        button.dataset.receiptId = item.id;
        button.addEventListener('click', () => {
          activeId = item.id;
          notice.textContent = '';
          render();
          check();
        });
        history.append(button);
      }
      button.textContent = `${item.id} · ${labels[item.status] || 'Checking'}`;
      button.setAttribute('aria-pressed', String(item.id === activeId));
    });
    if (!receipt) return;
    const signature = JSON.stringify([receipt, errors.get(receipt.id)]);
    if (signature === contentSignature) return;
    contentSignature = signature;
    content.replaceChildren();
    const status = document.createElement('strong');
    status.className = 'receipt-status';
    status.dataset.status = receipt.status || 'pending';
    status.textContent = errors.has(receipt.id)
      ? (receipt.status ? `Last known: ${labels[receipt.status]}` : 'Status unavailable')
      : labels[receipt.status] || 'Checking status…';
    const message = document.createElement('p');
    message.textContent = errors.get(receipt.id) || messages[receipt.status] || 'Loading your receipt.';
    const details = document.createElement('dl');
    const fields = [['Reference', receipt.id]];
    if (receipt.sport) fields.push(['Court', receipt.court_assigned || receipt.sport]);
    if (receipt.status) {
      fields.push(['Requested slot', `${receipt.date || 'Flexible date'} · ${receipt.time || 'Flexible time'}`]);
      fields.push(['Duration', `${receipt.duration} hour${Number(receipt.duration) === 1 ? '' : 's'}`]);
    }
    fields.forEach(([label, value]) => {
      const term = document.createElement('dt');
      term.textContent = label;
      const detail = document.createElement('dd');
      detail.textContent = value;
      details.append(term, detail);
    });
    content.append(status, message, details);
    copy.disabled = !receipt;
  }

  async function check() {
    if (checking || !receipts.length) return;
    checking = true;
    refresh.disabled = true;
    refresh.textContent = 'Checking…';
    const activeAtStart = activeId;
    const results = await Promise.all(receipts.map(async receipt => {
      try {
        const response = await fetch(`/api/requests/${encodeURIComponent(receipt.id)}/receipt`, {
          headers: { 'X-Receipt-Token': receipt.token }, cache: 'no-store',
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error(response.status === 404
          ? 'Receipt unavailable. Check your tracking link or contact us.'
          : 'Unable to update. Retrying automatically.');
        const result = await response.json();
        if (!result.success || !Object.hasOwn(labels, result.data?.status)) throw new Error('Unable to update. Retrying automatically.');
        // Do not restore receipts cleared while a request was in flight.
        if (!receipts.includes(receipt)) return;
        const changed = receipt.status && receipt.status !== result.data.status;
        errors.delete(receipt.id);
        Object.assign(receipt, result.data);
        return { id: receipt.id, changed, text: `${receipt.sport}: ${labels[receipt.status]}. ${messages[receipt.status]}` };
      } catch (error) {
        const message = error.message.includes('Receipt unavailable') ? error.message : 'Unable to update. Retrying automatically.';
        errors.set(receipt.id, message);
        return { id: receipt.id, error: message };
      }
    }));
    checking = false;
    refresh.disabled = false;
    refresh.textContent = 'Refresh';
    persist();
    render();
    const changed = results.filter(result => result?.changed);
    const current = results.find(result => result?.id === activeId);
    if (changed.length) notice.textContent = changed.map(result => result.text).join(' ');
    else if (activeId === activeAtStart) notice.textContent = current?.error || 'Up to date.';
  }

  function openLink() {
    const match = location.hash.match(/^#receipt=([^/.]+)\.([a-f0-9]{64})$/);
    if (!match) return;
    let id;
    try { id = decodeURIComponent(match[1]); } catch { return; }
    receipts = [{ id, token: match[2] }, ...receipts.filter(item => item.id !== id)].slice(0, 4);
    activeId = id;
    persist();
    render();
    panel.scrollIntoView({ block: 'center' });
    check();
  }
  refresh.addEventListener('click', check);
  copy.addEventListener('click', async () => {
    const receipt = receipts.find(item => item.id === activeId);
    if (!receipt) return;
    const link = linkFor(receipt);
    try {
      await navigator.clipboard.writeText(link);
      notice.textContent = 'Tracking link copied. Keep it private.';
    } catch {
      const input = document.createElement('input');
      input.type = 'text';
      input.readOnly = true;
      input.value = link;
      input.className = 'form-input';
      input.setAttribute('aria-label', 'Private tracking link');
      notice.replaceChildren(input);
      input.focus();
      input.select();
    }
  });
  document.getElementById('clear-inquiries-btn').addEventListener('click', () => {
    receipts = [];
    activeId = undefined;
    persist();
    notice.textContent = '';
    if (location.hash.startsWith('#receipt=')) window.history.replaceState(null, '', location.pathname + location.search);
    render();
  });
  window.addEventListener('hashchange', openLink);
  window.addEventListener('online', check);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  setInterval(() => { if (!document.hidden) check(); }, 15000);
  activeId = receipts[0]?.id;
  render();
  if (location.hash.startsWith('#receipt=')) openLink();
  else check();

  return {
    add(data, token) {
      const { id, sport, date, time, duration, status, court_assigned, created_at, updated_at } = data;
      receipts = [{ id, sport, date, time, duration, status, court_assigned, created_at, updated_at, token },
        ...receipts.filter(item => item.id !== id)].slice(0, 4);
      activeId = id;
      persist();
      render();
      notice.textContent = 'Inquiry received.';
      panel.focus({ preventScroll: true });
      panel.scrollIntoView({ block: 'nearest' });
    },
  };
}
