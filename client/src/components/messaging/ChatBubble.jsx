import { Check, CheckCheck, Mic } from 'lucide-react';

export default function ChatBubble({ message, isOwn }) {
  const isVoice = message.contentType === 'VOICE';

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
          isOwn
            ? 'bg-gold text-dark rounded-br-md'
            : 'bg-dark-50 text-white rounded-bl-md'
        }`}
      >
        {isVoice ? (
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
