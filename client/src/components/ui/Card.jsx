export default function Card({ children, elevated, className = '', ...props }) {
  return (
    <div className={`${elevated ? 'card-elevated' : 'card'} ${className}`} {...props}>
      {children}
    </div>
  );
}
