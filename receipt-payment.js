import { paymentMethodLabel } from './payment-methods.js';

export function createPaymentChooser(onSaved) {
  const form = document.getElementById('receipt-payment-form');
  const fieldset = form.querySelector('fieldset');
  const button = form.querySelector('button');
  const feedback = document.getElementById('payment-feedback');
  const radios = [...form.querySelectorAll('input[name="payment_method"]')];
  const drafts = new Map();
  let receipt;
  let saving = false;
  function render() {
    form.hidden = !receipt?.status;
    if (form.hidden) return;
    const closed = ['completed', 'rejected'].includes(receipt.status);
    fieldset.disabled = saving || closed;
    button.textContent = saving ? 'Saving...' : 'Save payment method';
    const selected = drafts.get(receipt.id) ?? receipt.payment_method;
    radios.forEach(radio => { radio.checked = radio.value === selected; });
    if (closed) feedback.textContent = 'Payment preferences are closed for this inquiry.';
  }
  form.addEventListener('change', () => {
    if (!receipt) return;
    drafts.set(receipt.id, new FormData(form).get('payment_method'));
    feedback.textContent = '';
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!receipt || saving || !form.reportValidity()) return;
    const current = receipt;
    const method = new FormData(form).get('payment_method');
    saving = true;
    feedback.textContent = '';
    render();
    let message;
    try {
      const response = await fetch(`/api/requests/${encodeURIComponent(current.id)}/payment-method`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Receipt-Token': current.token },
        body: JSON.stringify({ payment_method: method }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok || !result.success || result.data?.payment_method !== method) {
        const messages = {
          404: 'Receipt unavailable. Open your private tracking link and try again.',
          409: 'Payment preferences are closed for this inquiry.',
          422: 'Choose Cash, Card, GCash, or Other.',
        };
        throw new Error(messages[response.status] || 'Unable to save your payment method. Please try again.');
      }
      drafts.delete(current.id);
      onSaved(current, result.data);
      message = `${paymentMethodLabel(method)} saved as your preferred payment method.`;
    } catch (error) {
      message = error instanceof Error && /^(Receipt unavailable|Payment preferences|Choose Cash|Unable to save)/.test(error.message)
        ? error.message : 'Unable to confirm the change. Refresh your receipt before trying again.';
    } finally {
      saving = false;
      render();
      if (receipt?.id === current.id) feedback.textContent = message;
    }
  });
  return {
    setReceipt(next) {
      if (receipt?.id !== next?.id) feedback.textContent = '';
      receipt = next;
      render();
    },
    clear() { drafts.clear(); feedback.textContent = ''; },
  };
}
