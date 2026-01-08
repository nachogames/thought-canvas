import type { LucideIcon, LucideProps } from 'lucide-react'

interface IconProps extends LucideProps {
  icon: LucideIcon
}

export function Icon({ icon: IconComponent, className = '', size = 16, ...props }: IconProps) {
  return <IconComponent className={className} size={size} {...props} />
}
