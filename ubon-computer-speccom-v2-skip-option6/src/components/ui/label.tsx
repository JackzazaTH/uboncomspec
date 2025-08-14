import React from 'react'
export const Label: React.FC<React.LabelHTMLAttributes<HTMLLabelElement>> = ({ className='', ...props }) => <label className={`text-sm text-slate-700 ${className}`} {...props} />
export default Label
