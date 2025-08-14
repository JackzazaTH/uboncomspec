import React from 'react'
export const Badge: React.FC<{children?: React.ReactNode, className?: string, variant?: 'secondary'|'default'}> = ({ children, className='', variant='default' }) => (
  <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded-xl ${variant==='secondary'?'bg-slate-200 text-slate-900':'bg-slate-900 text-white'} ${className}`}>{children}</span>
)
export default Badge
