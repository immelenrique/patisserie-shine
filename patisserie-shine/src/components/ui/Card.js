export function Card({ children, className = '', hover = true }) {
  return (
    <div 
      className={`
        bg-white rounded-xl shadow-sm border border-gray-200 
        transition-all duration-200 
        ${hover ? 'hover:shadow-md hover:-translate-y-0.5' : ''} 
        ${className}
      `}
    >
      {children}
    </div>
  );
}
