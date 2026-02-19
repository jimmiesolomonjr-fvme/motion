import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import api from '../services/api';

const SocketContext = createContext(null);
const NotificationContext = createContext({ unreadCount: 0, setUnreadCount: () => {}, matchAlert: null, clearMatchAlert: () => {} });

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [matchAlert, setMatchAlert] = useState(null);

  const clearMatchAlert = useCallback(() => setMatchAlert(null), []);

  // Fetch initial unread count
  useEffect(() => {
    if (!user) { setUnreadCount(0); return; }
    api.get('/messages/conversations').then(({ data }) => {
      const count = data.filter(
        (c) => c.lastMessage && !c.lastMessage.read && c.lastMessage.senderId !== user.id
      ).length;
      setUnreadCount(count);
    }).catch(() => {});
  }, [user?.id]);

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
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    // Increment unread on new message notification
    newSocket.on('message-notification', () => {
      setUnreadCount((prev) => prev + 1);
    });

    // Match notification
    newSocket.on('match-notification', (data) => {
      setMatchAlert(data);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user?.id]);

  return (
    <SocketContext.Provider value={socket}>
      <NotificationContext.Provider value={{ unreadCount, setUnreadCount, matchAlert, clearMatchAlert }}>
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
