import { DATE_ENERGY_OPTIONS } from '../../utils/constants';

export default function DateEnergyBadge({ energy, size = 'sm' }) {
  if (!energy) return null;
  const opt = DATE_ENERGY_OPTIONS.find((o) => o.value === energy);
  if (!opt) return null;

  const sizeClasses = size === 'md'
    ? 'px-3 py-1 text-sm'
    : 'px-2 py-0.5 text-xs';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClasses} ${opt.bg} ${opt.color} border ${opt.border}`}>
      {opt.emoji} {opt.value}
    </span>
  );
}
