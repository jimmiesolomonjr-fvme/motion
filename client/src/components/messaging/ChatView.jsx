import { useState, useEffect, useRef } from 'react';
import { Send, Mic, Square, ArrowLeft, Crown, ImagePlus, MoreVertical, UserX, Trash2, Zap, X, Loader } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import ChatBubble from './ChatBubble';
import Avatar from '../ui/Avatar';
import Modal from '../ui/Modal';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { isOnline } from '../../utils/formatters';

export default function ChatView({ conversationId, otherUser }) {
  const { user, refreshUser } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [recording, setRecording] = useState(false);
  const [typing, setTyping] = useState(false);
  const [socketError, setSocketError] = useState('');
  const [upgrading, setUpgrading] = useState(false);
  const [freeMessaging, setFreeMessaging] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMatched, setIsMatched] = useState(false);
  const [showUnmatchModal, setShowUnmatchModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [icebreakers, setIcebreakers] = useState([]);
  const [activePickerMsgId, setActivePickerMsgId] = useState(null);
  const [sendingImage, setSendingImage] = useState(null); // { file, preview, progress }
  const imageAbortRef = useRef(null);
  const [voicePreview, setVoicePreview] = useState(null); // { blob, url, duration }
  const [voiceSending, setVoiceSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const menuRef = useRef(null);
  const bottomRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordingStartRef = useRef(null);

  const needsPremium = user?.role === 'STEPPER' && !user?.isPremium && !freeMessaging;

  useEffect(() => {
    api.get(`/messages/${conversationId}`).then(({ data }) => {
      setMessages(data);
      if (data.length === 0 && otherUser?.id) {
        api.get(`/messages/icebreakers/${otherUser.id}`).then(({ data: ib }) => {
          setIcebreakers(ib.icebreakers || []);
        }).catch(() => {});
      }
    });
    api.get('/payments/status').then(({ data }) => {
      if (data.freeMessaging !== undefined) setFreeMessaging(data.freeMessaging);
    }).catch(() => {});
    // Check if matched with other user
    if (otherUser?.id) {
      api.get('/likes/matches').then(({ data }) => {
        setIsMatched(data.some((m) => m.user.id === otherUser.id));
      }).catch(() => {});
    }
  }, [conversationId, otherUser?.id]);

  // Close menu on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.emit('join-conversation', conversationId);
    socket.emit('mark-read', { conversationId });

    const handleNewMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
      if (msg.senderId === user.id) {
        pendingMessageRef.current = '';
      } else {
        socket.emit('mark-read', { conversationId });
      }
    };

    const handleSendError = (data) => {
      if (data?.conversationId === conversationId || !data?.conversationId) {
        setSocketError(data?.error || 'Failed to send message');
        if (pendingMessageRef.current) {
          setInput(pendingMessageRef.current);
          pendingMessageRef.current = '';
        }
        setTimeout(() => setSocketError(''), 5000);
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

    const handleError = (data) => {
      if (data?.error) setSocketError(data.error);
    };

    const handleReaction = (data) => {
      setMessages((prev) => prev.map((m) =>
        m.id === data.messageId ? { ...m, reactions: data.reactions } : m
      ));
    };

    socket.on('new-message', handleNewMessage);
    socket.on('user-typing', handleTyping);
    socket.on('user-stop-typing', handleStopTyping);
    socket.on('messages-read', handleRead);
    socket.on('error', handleError);
    socket.on('send-message-error', handleSendError);
    socket.on('message-reaction', handleReaction);

    return () => {
      socket.emit('leave-conversation', conversationId);
      socket.off('new-message', handleNewMessage);
      socket.off('user-typing', handleTyping);
      socket.off('user-stop-typing', handleStopTyping);
      socket.off('messages-read', handleRead);
      socket.off('error', handleError);
      socket.off('send-message-error', handleSendError);
      socket.off('message-reaction', handleReaction);
    };
  }, [socket, conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const pendingMessageRef = useRef('');

  const sendMessage = () => {
    if (!input.trim() || !socket) return;

    if (!socket.connected) {
      setSocketError('Connection lost, reconnecting...');
      return;
    }

    pendingMessageRef.current = input.trim();
    socket.emit('send-message', { conversationId, content: input.trim(), replyToId: replyingTo?.id || undefined });
    setInput('');
    setReplyingTo(null);
    setIcebreakers([]);
    socket.emit('stop-typing', { conversationId });
  };

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      await api.post('/payments/free-upgrade');
      await refreshUser();
      setSocketError('');
    } catch (err) {
      console.error('Upgrade error:', err);
    } finally {
      setUpgrading(false);
    }
  };

  const handleReact = (messageId, emoji) => {
    if (!socket) return;
    socket.emit('react-message', { messageId, emoji, conversationId });
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
      recordingStartRef.current = Date.now();

      mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const duration = Math.round((Date.now() - recordingStartRef.current) / 1000);
        setVoicePreview({ blob, url, duration });
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

  const sendVoiceNote = async () => {
    if (!voicePreview) return;
    setVoiceSending(true);
    const formData = new FormData();
    formData.append('voice', voicePreview.blob, 'voice.webm');
    try {
      await api.post(`/messages/${conversationId}/voice`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } catch {
      // Handle silently
    }
    URL.revokeObjectURL(voicePreview.url);
    setVoicePreview(null);
    setVoiceSending(false);
  };

  const discardVoiceNote = () => {
    if (voicePreview) URL.revokeObjectURL(voicePreview.url);
    setVoicePreview(null);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const preview = URL.createObjectURL(file);
    setSendingImage({ file, preview, progress: 0 });

    const abortController = new AbortController();
    imageAbortRef.current = abortController;

    const formData = new FormData();
    formData.append('image', file);
    try {
      await api.post(`/messages/${conversationId}/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal: abortController.signal,
        onUploadProgress: (e) => {
          const pct = Math.round((e.loaded * 100) / (e.total || 1));
          setSendingImage((prev) => prev ? { ...prev, progress: pct } : null);
        },
      });
    } catch (err) {
      if (abortController.signal.aborted) return;
      setSendingImage((prev) => prev ? { ...prev, error: true } : null);
      setTimeout(() => setSendingImage(null), 3000);
      return;
    } finally {
      imageAbortRef.current = null;
    }
    URL.revokeObjectURL(preview);
    setSendingImage(null);
  };

  const cancelImageUpload = () => {
    if (imageAbortRef.current) imageAbortRef.current.abort();
    if (sendingImage?.preview) URL.revokeObjectURL(sendingImage.preview);
    setSendingImage(null);
  };

  const handleUnmatch = async () => {
    try {
      await api.delete(`/likes/unmatch/${otherUser.id}`);
      navigate('/messages');
    } catch (err) {
      console.error('Unmatch error:', err);
    }
  };

  const handleDeleteConversation = async () => {
    try {
      await api.delete(`/messages/conversations/${conversationId}`);
      navigate('/messages');
    } catch (err) {
      console.error('Delete conversation error:', err);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-dark-50" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
        <Link to="/messages" className="text-gray-400 hover:text-white">
          <ArrowLeft size={20} />
        </Link>
        <Link to={`/profile/${otherUser?.id}`} className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar src={otherUser?.profile?.photos} name={otherUser?.profile?.displayName} size="sm" online={isOnline(otherUser?.lastOnline)} />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-sm">{otherUser?.profile?.displayName}</h3>
          {typing ? (
            <p className="text-xs text-gold">typing...</p>
          ) : (
            <p className="text-xs text-gray-500">{isOnline(otherUser?.lastOnline) ? 'Online' : 'Offline'}</p>
          )}
          </div>
        </Link>
        {/* Three-dot menu */}
        <div className="relative" ref={menuRef}>
          <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 text-gray-400 hover:text-white transition-colors">
            <MoreVertical size={20} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-dark-100 border border-dark-50 rounded-xl overflow-hidden shadow-xl z-50">
              {isMatched && (
                <button
                  onClick={() => { setMenuOpen(false); setShowUnmatchModal(true); }}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-400 hover:bg-dark-50 transition-colors"
                >
                  <UserX size={16} /> Unmatch
                </button>
              )}
              <button
                onClick={() => { setMenuOpen(false); setShowDeleteModal(true); }}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-400 hover:bg-dark-50 transition-colors"
              >
                <Trash2 size={16} /> Delete Conversation
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1" onClick={() => setActivePickerMsgId(null)}>
        {messages.length === 0 && icebreakers.length > 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Zap className="text-gold" size={24} />
            <p className="text-sm text-gray-500">Break the ice</p>
            <div className="flex flex-wrap justify-center gap-2">
              {icebreakers.map((ib, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(ib.text); setIcebreakers([]); }}
                  className="px-3 py-2 bg-dark-100 border border-gold/20 rounded-full text-sm text-gold hover:bg-gold/10 transition-colors max-w-[280px] truncate"
                >
                  {ib.text}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} isOwn={msg.senderId === user.id} onReact={handleReact} currentUserId={user.id} showPicker={activePickerMsgId === msg.id} onTogglePicker={(id) => setActivePickerMsgId((prev) => prev === id ? null : id)} onReply={(msg) => setReplyingTo(msg)} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-dark-50">
        {needsPremium ? (
          <div className="text-center py-2 space-y-2">
            <p className="text-sm text-gray-400">Steppers need Premium to send messages</p>
            <button
              onClick={handleUpgrade}
              disabled={upgrading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gold text-dark rounded-xl font-semibold text-sm hover:bg-gold/90 disabled:opacity-50"
            >
              <Crown size={16} />
              {upgrading ? 'Upgrading...' : 'Upgrade to Premium'}
            </button>
          </div>
        ) : (
          <>
            {socketError && <p className="text-xs text-red-400 mb-2 text-center">{socketError}</p>}

            {/* Reply preview */}
            {replyingTo && (
              <div className="flex items-center gap-2 mb-2 p-2 bg-dark-50 rounded-xl border-l-2 border-gold">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gold font-medium">
                    Replying to {replyingTo.senderId === user.id ? 'yourself' : otherUser?.profile?.displayName}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {replyingTo.contentType === 'IMAGE' ? 'Photo' : replyingTo.contentType === 'VOICE' ? 'Voice note' : replyingTo.content}
                  </p>
                </div>
                <button onClick={() => setReplyingTo(null)} className="p-1 text-gray-400 hover:text-white">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Image upload preview */}
            {sendingImage && (
              <div className="flex items-center gap-3 mb-2 p-2 bg-dark-50 rounded-xl">
                <img src={sendingImage.preview} alt="" className="w-12 h-12 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  {sendingImage.error ? (
                    <p className="text-xs text-red-400">Upload failed</p>
                  ) : (
                    <>
                      <div className="w-full h-1.5 bg-dark-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${sendingImage.progress}%` }} />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{sendingImage.progress}%</p>
                    </>
                  )}
                </div>
                <button onClick={cancelImageUpload} className="p-1 text-gray-400 hover:text-white">
                  <X size={14} />
                </button>
              </div>
            )}

            {voicePreview ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 flex-1 px-3 py-2 bg-dark-50 rounded-xl">
                  <Mic size={16} className="text-gray-400 shrink-0" />
                  <audio controls src={voicePreview.url} className="h-8 flex-1 min-w-0" style={{ filter: 'invert(1)' }} />
                </div>
                <span className="text-xs text-gray-500 tabular-nums shrink-0">{voicePreview.duration}s</span>
                <button onClick={discardVoiceNote} className="p-2.5 rounded-xl bg-dark-50 text-red-400 hover:text-red-300 transition-colors">
                  <Trash2 size={18} />
                </button>
                <button onClick={sendVoiceNote} disabled={voiceSending} className="p-2.5 bg-gold rounded-xl text-dark disabled:opacity-50">
                  {voiceSending ? <Loader size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <label className="p-2.5 rounded-xl bg-dark-50 text-gray-400 hover:text-white transition-colors cursor-pointer">
                  <ImagePlus size={18} />
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
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
            )}
          </>
        )}
      </div>

      {/* Unmatch Modal */}
      <Modal isOpen={showUnmatchModal} onClose={() => setShowUnmatchModal(false)} title="Unmatch">
        <p className="text-sm text-gray-400 mb-4">
          This will remove your match with <span className="text-white font-medium">{otherUser?.profile?.displayName}</span> and delete your conversation. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setShowUnmatchModal(false)} className="flex-1 px-4 py-2.5 bg-dark-100 text-white rounded-xl font-semibold text-sm hover:bg-dark-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleUnmatch} className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl font-semibold text-sm hover:bg-red-600 transition-colors">
            Unmatch
          </button>
        </div>
      </Modal>

      {/* Delete Conversation Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Conversation">
        <p className="text-sm text-gray-400 mb-4">
          Delete this conversation and all messages? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-4 py-2.5 bg-dark-100 text-white rounded-xl font-semibold text-sm hover:bg-dark-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleDeleteConversation} className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl font-semibold text-sm hover:bg-red-600 transition-colors">
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
