export default function ProfileRing({ percent, missing, onEditProfile }) {
  const size = 80;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-dark-50"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="text-gold transition-all duration-500"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
          {percent}%
        </span>
      </div>
      {missing.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {missing.map((item) => (
            <button
              key={item.key}
              onClick={onEditProfile}
              className="px-2.5 py-1 bg-gold/10 text-gold text-xs font-medium rounded-full border border-gold/20 hover:bg-gold/20 transition-colors"
            >
              + {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
