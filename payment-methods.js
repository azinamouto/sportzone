export const PAYMENT_METHODS = Object.freeze({ cash: 'Cash', card: 'Card', gcash: 'GCash', other: 'Other' });
export function paymentMethodLabel(method) {
  return Object.hasOwn(PAYMENT_METHODS, method) ? PAYMENT_METHODS[method] : 'Not selected';
}
