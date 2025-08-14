import React from 'react'
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default'|'secondary'|'destructive', size?: 'default'|'icon' }
export const Button: React.FC<Props> = ({ variant='default', size='default', className='', ...props }) => {
  const v = variant==='secondary' ? 'bg-slate-200 hover:bg-slate-300 text-slate-900' : variant==='destructive' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'
  const s = size==='icon' ? 'p-2 rounded-xl' : 'px-4 py-2 rounded-2xl'
  return <button className={`${v} ${s} transition ${className}`} {...props} />
}
export default Button
