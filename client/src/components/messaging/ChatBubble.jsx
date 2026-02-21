import { useState, useRef } from 'react';
import { Check, CheckCheck, Mic, X } from 'lucide-react';

const REACTION_EMOJIS = ['\u2764\uFE0F', '\uD83D\uDE02', '\uD83D\uDE2E', '\uD83D\uDE22', '\uD83D\uDD25', '\uD83D\uDC4D'];

export default function ChatBubble({ message, isOwn, onReact, currentUserId }) {
  const isVoice = message.contentType === 'VOICE';
  const isImage = message.contentType === 'IMAGE';
  const [lightbox, setLightbox] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const lastTapRef = useRef(0);

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setShowPicker((prev) => !prev);
    }
    lastTapRef.current = now;
  };

  const handleReact = (emoji) => {
    onReact?.(message.id, emoji);
    setShowPicker(false);
  };

  // Group reactions by emoji with counts
  const reactions = message.reactions || [];
  const grouped = reactions.reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { emoji: r.emoji, count: 0, hasOwn: false };
    acc[r.emoji].count++;
    if (r.userId === currentUserId) acc[r.emoji].hasOwn = true;
    return acc;
  }, {});
  const reactionGroups = Object.values(grouped);

  return (
    <>
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className="relative">
        <div
          className={`max-w-[75%] rounded-2xl ${isImage ? 'p-1' : 'px-4 py-2'} ${
            isOwn
              ? 'bg-gold text-dark rounded-br-md'
              : 'bg-dark-50 text-white rounded-bl-md'
          }`}
          onClick={handleTap}
        >
          {isImage ? (
            <img
              src={message.content}
              alt=""
              className="rounded-xl max-w-full max-h-64 object-cover cursor-pointer"
              onClick={(e) => { e.stopPropagation(); setLightbox(true); }}
            />
          ) : isVoice ? (
            <VoicePlayer src={message.content} isOwn={isOwn} />
          ) : (
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          )}
          <div className={`flex items-center justify-end gap-1 mt-1 ${isOwn ? 'text-dark/60' : 'text-gray-500'}`}>
            <span className="text-[10px]">
              {new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </span>
            {isOwn && (
              message.readAt
                ? <CheckCheck size={12} className="text-blue-400" />
                : <Check size={12} />
            )}
          </div>
        </div>

        {/* Reaction picker */}
        {showPicker && (
          <div className={`absolute ${isOwn ? 'right-0' : 'left-0'} bottom-full mb-1 flex gap-1 bg-dark-100 border border-dark-50 rounded-full px-2 py-1 shadow-xl z-10`}>
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={(e) => { e.stopPropagation(); handleReact(emoji); }}
                className="text-lg hover:scale-125 transition-transform px-0.5"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Reaction display */}
        {reactionGroups.length > 0 && (
          <div className={`flex gap-1 mt-0.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            {reactionGroups.map((r) => (
              <button
                key={r.emoji}
                onClick={() => r.hasOwn && onReact?.(message.id, r.emoji)}
                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs ${
                  r.hasOwn ? 'bg-gold/20 border border-gold/40' : 'bg-dark-50 border border-dark-50'
                }`}
              >
                <span>{r.emoji}</span>
                {r.count > 1 && <span className="text-gray-400">{r.count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>

    {/* Lightbox for images */}
    {lightbox && isImage && (
      <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(false)}>
        <button className="absolute top-4 right-4 text-white" onClick={() => setLightbox(false)}>
          <X size={24} />
        </button>
        <img src={message.content} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
      </div>
    )}
    </>
  );
}

function VoicePlayer({ src, isOwn }) {
  return (
    <div className="flex items-center gap-2 min-w-[160px]">
      <Mic size={16} />
      <audio controls className="h-8 max-w-[200px]" style={{ filter: isOwn ? 'invert(1)' : 'none' }}>
        <source src={src} type="audio/webm" />
      </audio>
    </div>
  );
}
