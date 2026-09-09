import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'glossy' | 'ghost'
  children: ReactNode
}

export function Button({ variant = 'glossy', className = '', children, ...rest }: Props) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-medium tracking-tight cursor-pointer'
  const skin =
    variant === 'glossy'
      ? 'btn-glossy !text-white text-white'
      : 'btn-ghost text-neutral-900'
  return (
    <button className={`${base} ${skin} ${className}`} {...rest}>
      {children}
    </button>
  )
}
