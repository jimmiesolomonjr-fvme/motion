import { User } from 'lucide-react';

export default function Avatar({ src, name, size = 'md', online, className = '' }) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-20 h-20',
    xl: 'w-32 h-32',
  };

  const photo = Array.isArray(src) ? src[0] : src;

  return (
    <div className={`relative ${className}`}>
      {photo ? (
        <img
          src={photo}
          alt={name || 'User'}
          className={`${sizes[size]} rounded-full object-cover border-2 border-dark-50`}
        />
      ) : (
        <div className={`${sizes[size]} rounded-full bg-dark-100 border-2 border-dark-50 flex items-center justify-center`}>
          <User className="text-gray-500" size={size === 'sm' ? 16 : size === 'xl' ? 40 : 24} />
        </div>
      )}
      {online && (
        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-dark" />
      )}
    </div>
  );
}
