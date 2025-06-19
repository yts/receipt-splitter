import type { LineItem } from '../types';

export interface ReceiptState {
  items: LineItem[];
  taxRate: string;
  discountType: 'percentage' | 'amount';
  discountValue: string;
}

// Convert state to URL-safe string
export function encodeState(state: ReceiptState): string {
  // Convert state to base64 to make it URL-safe
  return btoa(JSON.stringify(state));
}

// Parse URL-safe string back to state
export function decodeState(encoded: string): ReceiptState | null {
  try {
    return JSON.parse(atob(encoded));
  } catch (e) {
    console.error('Failed to decode state:', e);
    return null;
  }
}

const stateParamName = 'receipt';
export function getStateFromUrl(): ReceiptState | null {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get(stateParamName);
  if (!encoded) return null;
  return decodeState(encoded);
}

export function updateUrl(state: ReceiptState) {
  const encoded = encodeState(state);
  const url = new URL(window.location.href);
  url.searchParams.set(stateParamName, encoded);
  window.history.replaceState({}, '', url.toString());
}
