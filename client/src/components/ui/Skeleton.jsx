function Pulse({ className = '' }) {
  return <div className={`animate-pulse bg-dark-50 rounded-xl ${className}`} />;
}

export function FeedSkeleton({ mode = 'grid' }) {
  if (mode === 'vertical') {
    return (
      <div className="px-3 py-1.5">
        <div className="w-full rounded-2xl border border-dark-50 overflow-hidden" style={{ height: 'calc(100dvh - 13rem)' }}>
          <Pulse className="w-full rounded-none" style={{ height: '55%' }} />
          <div className="p-4 space-y-3">
            <Pulse className="h-5 w-40" />
            <Pulse className="h-4 w-24" />
            <Pulse className="h-10 w-full" />
            <Pulse className="h-10 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card-elevated overflow-hidden">
          <Pulse className="aspect-[3/4] mb-3" />
          <Pulse className="h-4 w-24 mx-2 mb-2" />
          <Pulse className="h-3 w-16 mx-2 mb-3" />
          <Pulse className="h-8 w-full" />
        </div>
      ))}
    </div>
  );
}

export function ConversationSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Pulse className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Pulse className="h-4 w-28" />
            <Pulse className="h-3 w-40" />
          </div>
          <Pulse className="h-3 w-10 flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}
