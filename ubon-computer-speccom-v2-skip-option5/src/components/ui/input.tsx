import React from 'react'
export const Input = ({ className='', ...props }: React.InputHTMLAttributes<HTMLInputElement>) => <input className={`border rounded-xl px-3 py-2 w-full outline-none focus:ring-2 focus:ring-slate-300 ${className}`} {...props} />
export default Input
