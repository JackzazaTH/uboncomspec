import React from 'react'
export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className='', ...props }) => <div className={`bg-white rounded-2xl border ${className}`} {...props} />
export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className='', ...props }) => <div className={`px-4 pt-4 ${className}`} {...props} />
export const CardTitle: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className='', ...props }) => <div className={`text-lg font-semibold ${className}`} {...props} />
export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className='', ...props }) => <div className={`px-4 pb-4 ${className}`} {...props} />
export default Card
