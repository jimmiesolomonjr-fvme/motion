export default function Button({ children, variant = 'gold', className = '', disabled, loading, ...props }) {
  const variants = {
    gold: 'btn-gold',
    outline: 'btn-outline',
    purple: 'btn-purple',
    ghost: 'text-gray-400 hover:text-white px-4 py-2 transition-colors',
    danger: 'bg-red-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-red-700 transition-all active:scale-95',
  };

  return (
    <button
      className={`${variants[variant]} ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
