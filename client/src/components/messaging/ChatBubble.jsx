import { useState } from 'react';
import { Check, CheckCheck, Mic, X } from 'lucide-react';

export default function ChatBubble({ message, isOwn }) {
  const isVoice = message.contentType === 'VOICE';
  const isImage = message.contentType === 'IMAGE';
  const [lightbox, setLightbox] = useState(false);

  return (
    <>
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`max-w-[75%] rounded-2xl ${isImage ? 'p-1' : 'px-4 py-2'} ${
          isOwn
            ? 'bg-gold text-dark rounded-br-md'
            : 'bg-dark-50 text-white rounded-bl-md'
        }`}
      >
        {isImage ? (
          <img
            src={message.content}
            alt=""
            className="rounded-xl max-w-full max-h-64 object-cover cursor-pointer"
            onClick={() => setLightbox(true)}
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
