const DEVICE_STORAGE_KEY = 'euroblock.deviceId';
const DEVICE_ID_COOKIE = 'euroblock_device_id';
type DeviceType = 'tablet' | 'mobile' | 'desktop' | 'unknown';

function fallbackId() {
  return `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function isLocalTestHost() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

export function getOrCreateDeviceId() {
  if (typeof window === 'undefined') return '';
  try {
    const existing = window.localStorage.getItem(DEVICE_STORAGE_KEY);
    if (existing) 
      return existing;
    const id = window.crypto?.randomUUID?.() || fallbackId();
    window.localStorage.setItem(DEVICE_STORAGE_KEY, id);
    document.cookie = `${DEVICE_ID_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    return id;
  } catch {
    const id = fallbackId();
    document.cookie = `${DEVICE_ID_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    return id;
  }
}

export function detectClientDeviceType(): DeviceType {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return 'unknown';
  const ua = navigator.userAgent || '';
  const lower = ua.toLowerCase();
  const touchPoints = navigator.maxTouchPoints || 0;
  const minScreen = Math.min(window.screen?.width || 0, window.screen?.height || 0);

  if (/ipad|tablet|playbook|silk|kindle/.test(lower)) return 'tablet';
  if (/android/.test(lower) && !/mobile/.test(lower)) return 'tablet';
  if (/macintosh/.test(lower) && touchPoints > 1) return 'tablet';
  if (touchPoints > 0 && minScreen >= 600) return 'tablet';
  if (/mobi|iphone|ipod|android.*mobile/.test(lower)) return 'mobile';
  if (touchPoints > 0 && minScreen > 0 && minScreen < 600) return 'mobile';
  if (isLocalTestHost()) return 'desktop';
  return 'desktop';
}

export function getDevicePayload() {
  return {
    deviceId: getOrCreateDeviceId(),
    deviceType: detectClientDeviceType(),
    userAgent: navigator.userAgent || '',
    platform: navigator.platform || '',
  };
}
