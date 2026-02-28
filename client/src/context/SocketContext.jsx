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
});

let toastIdCounter = 0;

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [matchAlert, setMatchAlert] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [notifCount, setNotifCount] = useState(0);
  const timersRef = useRef({});

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
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      // Subscribe to push notifications
      subscribeToPush();
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      // Refresh auth token on reconnect attempts so socket uses the latest token
      newSocket.auth.token = localStorage.getItem('accessToken');
    });

    // Increment unread on new message notification
    newSocket.on('message-notification', () => {
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

    setSocket(newSocket);

    return () => {
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
