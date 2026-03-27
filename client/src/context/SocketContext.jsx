import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import api from '../services/api';

const SocketContext = createContext(null);
const NotificationContext = createContext({
  unreadCount: 0,
  setUnreadCount: () => {},
  matchAlert: null,
  clearMatchAlert: () => {},
  toasts: [],
  dismissToast: () => {},
  notifCount: 0,
  viewingPulse: null,
  setActiveConversation: () => {},
});

let toastIdCounter = 0;

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [matchAlert, setMatchAlert] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [notifCount, setNotifCount] = useState(0);
  const [viewingPulse, setViewingPulse] = useState(null);
  const viewingPulseTimerRef = useRef(null);
  const timersRef = useRef({});
  const activeConversationRef = useRef(null);

  const setActiveConversation = useCallback((convId) => {
    activeConversationRef.current = convId;
  }, []);

  const clearMatchAlert = useCallback(() => setMatchAlert(null), []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  const addToast = useCallback((notification) => {
    const id = `toast-${++toastIdCounter}`;
    const toast = { id, ...notification };
    setToasts((prev) => [...prev.slice(-2), toast]); // keep max 3
    // Auto-dismiss after 5s
    timersRef.current[id] = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      delete timersRef.current[id];
    }, 5000);
  }, []);

  // Fetch initial unread counts
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setNotifCount(0);
      return;
    }
    api.get('/messages/conversations').then(({ data }) => {
      const count = data.filter(
        (c) => c.lastMessage && !c.lastMessage.read && c.lastMessage.senderId !== user.id
      ).length;
      setUnreadCount(count);
    }).catch(() => {});

    api.get('/notifications/unread-count').then(({ data }) => {
      setNotifCount(data.count);
    }).catch(() => {});
  }, [user?.id]);

  const subscribeToPush = async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

      const permission = Notification.permission;
      if (permission === 'denied') return;
      if (permission === 'default') {
        const result = await Notification.requestPermission();
        if (result !== 'granted') return;
      }

      const { data } = await api.get('/push/vapid-key');
      if (!data.publicKey) return;

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const applicationServerKey = Uint8Array.from(atob(data.publicKey.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      const subJson = subscription.toJSON();
      await api.post('/push/subscribe', {
        endpoint: subJson.endpoint,
        keys: { p256dh: subJson.keys.p256dh, auth: subJson.keys.auth },
      });
    } catch {
      // Push subscription is best-effort
    }
  };

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const token = localStorage.getItem('accessToken');
    const newSocket = io({
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      // Subscribe to push notifications
      subscribeToPush();
    });

    let refreshingToken = false;
    newSocket.on('connect_error', async (err) => {
      console.error('Socket connection error:', err.message);
      const msg = (err.message || '').toLowerCase();
      if ((msg.includes('token') || msg.includes('auth') || msg.includes('unauthorized')) && !refreshingToken) {
        refreshingToken = true;
        try {
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            const { data } = await api.post('/auth/refresh', { refreshToken });
            localStorage.setItem('accessToken', data.accessToken);
            if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
            newSocket.auth.token = data.accessToken;
          }
        } catch {
          // Refresh failed — Socket.io will keep retrying with backoff
        } finally {
          refreshingToken = false;
        }
      } else {
        newSocket.auth.token = localStorage.getItem('accessToken');
      }
    });

    // Increment unread on new message notification (skip if user is in that chat)
    newSocket.on('message-notification', (data) => {
      if (data?.conversationId && data.conversationId === activeConversationRef.current) return;
      setUnreadCount((prev) => prev + 1);
    });

    // Match notification
    newSocket.on('match-notification', (data) => {
      setMatchAlert(data);
      addToast({ type: 'match', title: "It's a Match!", body: `You and ${data.user?.displayName} liked each other`, data });
      setNotifCount((prev) => prev + 1);
    });

    // General notification (profile views, etc.)
    newSocket.on('notification', (data) => {
      addToast({ type: data.type, title: data.title, body: data.body, data: data.data });
      setNotifCount((prev) => prev + 1);
    });

    // Live "viewing pulse" — ephemeral, shows when someone is on your profile
    newSocket.on('viewing-pulse', (data) => {
      if (viewingPulseTimerRef.current) clearTimeout(viewingPulseTimerRef.current);
      setViewingPulse(data);
      viewingPulseTimerRef.current = setTimeout(() => setViewingPulse(null), 8000);
    });

    newSocket.on('viewing-pulse-end', () => {
      setViewingPulse(null);
      if (viewingPulseTimerRef.current) {
        clearTimeout(viewingPulseTimerRef.current);
        viewingPulseTimerRef.current = null;
      }
    });

    setSocket(newSocket);

    // When PWA resumes from background, force immediate reconnect
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !newSocket.connected) {
        newSocket.auth.token = localStorage.getItem('accessToken');
        newSocket.connect();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      newSocket.disconnect();
    };
  }, [user?.id]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearTimeout);
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      <NotificationContext.Provider value={{
        unreadCount, setUnreadCount,
        matchAlert, clearMatchAlert,
        toasts, dismissToast,
        notifCount, setNotifCount,
        viewingPulse,
        setActiveConversation,
      }}>
        {children}
      </NotificationContext.Provider>
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}

export function useNotifications() {
  return useContext(NotificationContext);
}
