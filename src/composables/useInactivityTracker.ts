import { onScopeDispose, ref, watch } from "vue";
import { getApiBaseUrl, refreshSession } from "../api";
import { useSessionStore } from "../stores/session";

export interface InactivityOptions {
  idleTimeoutMs?: number;
  warningDurationSeconds?: number;
  onSignOut?: () => void;
}

export function useInactivityTracker(options: InactivityOptions = {}) {
  const session = useSessionStore();
  
  // 14 minutos por defecto para advertencia, 60 segundos de cuenta regresiva
  const idleTimeoutMs = options.idleTimeoutMs ?? 14 * 60 * 1000;
  const warningDurationSeconds = options.warningDurationSeconds ?? 60;
  
  const isWarningActive = ref(false);
  const countdown = ref(warningDurationSeconds);
  const isRefreshing = ref(false);
  
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let countdownInterval: ReturnType<typeof setInterval> | null = null;
  let lastActivityTimestamp = Date.now();
  
  const channel =
    typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel(`security-baseline-inactivity:${getApiBaseUrl()}`);

  function clearTimers() {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }

  function startCountdown() {
    isWarningActive.value = true;
    countdown.value = warningDurationSeconds;
    
    if (countdownInterval) clearInterval(countdownInterval);
    
    countdownInterval = setInterval(() => {
      countdown.value -= 1;
      if (countdown.value <= 0) {
        clearTimers();
        isWarningActive.value = false;
        handleTimeout();
      }
    }, 1000);
  }

  function resetIdleTimer(broadcast = false) {
    if (session.status !== "authenticated") return;
    
    clearTimers();
    isWarningActive.value = false;
    countdown.value = warningDurationSeconds;
    lastActivityTimestamp = Date.now();

    idleTimer = setTimeout(() => {
      startCountdown();
    }, idleTimeoutMs);

    if (broadcast) {
      channel?.postMessage({ type: "session-active", timestamp: lastActivityTimestamp });
    }
  }

  function onUserActivity() {
    // Si la advertencia ya está visible en pantalla, no la cerramos por simple movimiento de mouse;
    // requerimos interacción explícita con el modal para renovar.
    if (isWarningActive.value) return;
    
    const now = Date.now();
    // Throttle para evitar llamadas continuas en mousemove (al menos 2s entre reseteos)
    if (now - lastActivityTimestamp > 2000) {
      resetIdleTimer(true);
    }
  }

  async function stayConnected() {
    isRefreshing.value = true;
    try {
      await refreshSession();
    } catch {
      // Si falla, al menos reseteamos localmente y verificamos estado
    } finally {
      isRefreshing.value = false;
      resetIdleTimer(true);
    }
  }

  function handleTimeout() {
    if (options.onSignOut) {
      options.onSignOut();
    } else {
      session.signOut();
    }
  }

  function signOutNow() {
    clearTimers();
    isWarningActive.value = false;
    handleTimeout();
  }

  // Sincronización multi-pestaña
  const onChannelMessage = (event: MessageEvent) => {
    if (event.data?.type === "session-active") {
      if (isWarningActive.value) {
        clearTimers();
        isWarningActive.value = false;
      }
      resetIdleTimer(false);
    }
  };

  channel?.addEventListener("message", onChannelMessage);

  const events: (keyof WindowEventMap)[] = [
    "mousemove",
    "mousedown",
    "keydown",
    "scroll",
    "touchstart",
  ];

  function attachListeners() {
    events.forEach((evt) => window.addEventListener(evt, onUserActivity, { passive: true }));
  }

  function detachListeners() {
    events.forEach((evt) => window.removeEventListener(evt, onUserActivity));
  }

  watch(
    () => session.status,
    (status) => {
      if (status === "authenticated") {
        attachListeners();
        resetIdleTimer(false);
      } else {
        clearTimers();
        detachListeners();
        isWarningActive.value = false;
      }
    },
    { immediate: true },
  );

  onScopeDispose(() => {
    clearTimers();
    detachListeners();
    channel?.removeEventListener("message", onChannelMessage);
    channel?.close();
  });

  return {
    isWarningActive,
    countdown,
    isRefreshing,
    stayConnected,
    signOutNow,
    resetIdleTimer,
  };
}
