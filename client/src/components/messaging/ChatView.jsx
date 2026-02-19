import { useState, useEffect, useRef } from 'react';
import { Send, Mic, Square, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import ChatBubble from './ChatBubble';
import Avatar from '../ui/Avatar';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { isOnline } from '../../utils/formatters';

export default function ChatView({ conversationId, otherUser }) {
  const { user } = useAuth();
  const socket = useSocket();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [recording, setRecording] = useState(false);
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    api.get(`/messages/${conversationId}`).then(({ data }) => setMessages(data));
  }, [conversationId]);

  useEffect(() => {
    if (!socket) return;
    socket.emit('join-conversation', conversationId);
    socket.emit('mark-read', { conversationId });

    const handleNewMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
      if (msg.senderId !== user.id) {
        socket.emit('mark-read', { conversationId });
      }
    };

    const handleTyping = (data) => {
      if (data.userId !== user.id) setTyping(true);
    };
    const handleStopTyping = (data) => {
      if (data.userId !== user.id) setTyping(false);
    };
    const handleRead = () => {
      setMessages((prev) => prev.map((m) => (m.senderId === user.id ? { ...m, readAt: new Date() } : m)));
    };

    socket.on('new-message', handleNewMessage);
    socket.on('user-typing', handleTyping);
    socket.on('user-stop-typing', handleStopTyping);
    socket.on('messages-read', handleRead);

    return () => {
      socket.emit('leave-conversation', conversationId);
      socket.off('new-message', handleNewMessage);
      socket.off('user-typing', handleTyping);
      socket.off('user-stop-typing', handleStopTyping);
      socket.off('messages-read', handleRead);
    };
  }, [socket, conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !socket) return;
    socket.emit('send-message', { conversationId, content: input.trim() });
    setInput('');
    socket.emit('stop-typing', { conversationId });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInput = (e) => {
    setInput(e.target.value);
    if (socket) {
      socket.emit('typing', { conversationId });
      clearTimeout(window._typingTimer);
      window._typingTimer = setTimeout(() => {
        socket.emit('stop-typing', { conversationId });
      }, 2000);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('voice', blob, 'voice.webm');

        try {
          await api.post(`/messages/${conversationId}/voice`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch {
          // Handle error silently
        }

        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setRecording(true);
    } catch {
      // Microphone access denied
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-dark-50">
        <Link to="/messages" className="text-gray-400 hover:text-white">
          <ArrowLeft size={20} />
        </Link>
        <Avatar src={otherUser?.profile?.photos} name={otherUser?.profile?.displayName} size="sm" online={isOnline(otherUser?.lastOnline)} />
        <div>
          <h3 className="font-semibold text-white text-sm">{otherUser?.profile?.displayName}</h3>
          {typing ? (
            <p className="text-xs text-gold">typing...</p>
          ) : (
            <p className="text-xs text-gray-500">{isOnline(otherUser?.lastOnline) ? 'Online' : 'Offline'}</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} isOwn={msg.senderId === user.id} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-dark-50">
        <div className="flex items-center gap-2">
          <button
            onClick={recording ? stopRecording : startRecording}
            className={`p-2.5 rounded-xl transition-colors ${
              recording ? 'bg-red-500 text-white animate-pulse' : 'bg-dark-50 text-gray-400 hover:text-white'
            }`}
          >
            {recording ? <Square size={18} /> : <Mic size={18} />}
          </button>
          <input
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 input-field py-2.5"
          />
          <button onClick={sendMessage} disabled={!input.trim()} className="p-2.5 bg-gold rounded-xl text-dark disabled:opacity-30">
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
