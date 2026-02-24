export default function Input({ label, error, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>}
      <input className={`input-field ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`} {...props} />
      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
    </div>
  );
}

export function Textarea({ label, error, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>}
      <textarea
        className={`input-field min-h-[100px] resize-none ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
    </div>
  );
}
