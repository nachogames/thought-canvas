import { forwardRef, type TextareaHTMLAttributes } from 'react'

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`
          w-full resize-none
          bg-transparent border-none outline-none
          text-foreground text-base leading-relaxed
          placeholder:text-muted
          caret-accent
          font-sans
          ${className}
        `}
        {...props}
      />
    )
  }
)

TextArea.displayName = 'TextArea'
