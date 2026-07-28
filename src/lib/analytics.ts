type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    amplitude?: {
      init: (apiKey: string, userId?: string, options?: Record<string, unknown>) => void;
      track: (eventName: string, eventProperties?: Record<string, unknown>) => void;
      setUserId: (userId?: string) => void;
    };
  }
}

const GA_SCRIPT_ID = 'ga4-analytics-script';
const AMPLITUDE_SCRIPT_ID = 'amplitude-analytics-script';
const PENDING_SIGNUP_KEY = 'analytics.pending_signup';

let initialized = false;

function injectScript(id: string, src: string) {
  if (typeof document === 'undefined' || document.getElementById(id)) return;

  const script = document.createElement('script');
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

function ensureGtagStub() {
  if (typeof window === 'undefined') return;
  if (!window.dataLayer) window.dataLayer = [];
  if (!window.gtag) {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
  }
}

function ensureAmplitudeStub() {
  if (typeof window === 'undefined' || window.amplitude) return;

  const queue: Array<{ eventName: string; eventProperties?: Record<string, unknown> }> = [];

  window.amplitude = {
    init: () => undefined,
    track: (eventName, eventProperties) => {
      queue.push({ eventName, eventProperties });
    },
    setUserId: () => undefined,
  };

  injectScript(AMPLITUDE_SCRIPT_ID, 'https://cdn.amplitude.com/script/2.41.0/amplitude.min.js');

  const attachReadyHandler = () => {
    const amp = window.amplitude;
    if (!amp || typeof amp.init !== 'function' || !amp.track || amp.track === window.amplitude?.track) {
      window.setTimeout(attachReadyHandler, 150);
      return;
    }

    const amplitudeKey = import.meta.env.VITE_AMPLITUDE_API_KEY;
    if (amplitudeKey) {
      amp.init(amplitudeKey, undefined, {
        autocapture: true,
        defaultTracking: true,
      });
    }

    queue.splice(0).forEach(item => amp.track(item.eventName, item.eventProperties));
  };

  window.setTimeout(attachReadyHandler, 150);
}

export function initAnalytics() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  const gaMeasurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (gaMeasurementId) {
    injectScript(GA_SCRIPT_ID, `https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`);
    ensureGtagStub();
    window.gtag?.('js', new Date());
    window.gtag?.('config', gaMeasurementId, {
      send_page_view: false,
    });
  }

  const amplitudeKey = import.meta.env.VITE_AMPLITUDE_API_KEY;
  if (amplitudeKey) {
    ensureAmplitudeStub();
  }
}

export function identifyUser(userId: string | null | undefined) {
  if (typeof window === 'undefined') return;
  initAnalytics();

  const normalizedUserId = userId || undefined;
  window.amplitude?.setUserId(normalizedUserId);

  const gaMeasurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (gaMeasurementId) {
    window.gtag?.('config', gaMeasurementId, {
      user_id: normalizedUserId,
      send_page_view: false,
    });
  }
}

export function trackEvent(eventName: string, properties: AnalyticsProperties = {}) {
  if (typeof window === 'undefined') return;
  initAnalytics();

  const payload = Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined)
  );

  if (import.meta.env.VITE_GA_MEASUREMENT_ID) {
    window.gtag?.('event', eventName, payload);
  }

  if (import.meta.env.VITE_AMPLITUDE_API_KEY) {
    window.amplitude?.track(eventName, payload);
  }
}

export function markPendingSignup(method: 'email' | 'google') {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PENDING_SIGNUP_KEY, method);
}

export function consumePendingSignup(): 'email' | 'google' | null {
  if (typeof window === 'undefined') return null;
  const method = window.localStorage.getItem(PENDING_SIGNUP_KEY);
  if (method === 'email' || method === 'google') {
    window.localStorage.removeItem(PENDING_SIGNUP_KEY);
    return method;
  }
  return null;
}

export function hasTrackedFirstAction(userId: string, actionName: string) {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(`analytics.first_action.${userId}.${actionName}`) === 'true';
}

export function markFirstActionTracked(userId: string, actionName: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(`analytics.first_action.${userId}.${actionName}`, 'true');
}
