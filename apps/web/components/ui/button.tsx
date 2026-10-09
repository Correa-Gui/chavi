import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

// Alvos de toque >= 44 px: em ponteiro grosso (celular) todo botão cresce para h-11.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-ink text-surface hover:bg-shell-raised',
        accent: 'bg-accent text-ink hover:brightness-105',
        secondary: 'border border-line bg-surface text-ink hover:bg-panel',
        ghost: 'text-ink-2 hover:bg-column',
      },
      size: {
        sm: 'h-9 rounded-sm px-3 text-13 pointer-coarse:h-11',
        md: 'h-11 rounded-md px-4 text-14',
        icon: 'size-11 rounded-md',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

/** Botão sempre é <button>; com `asChild` o estilo vai para um <a> filho (link continua link). */
export function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...(asChild ? {} : { type: type ?? 'button' })}
      {...props}
    />
  );
}

export { buttonVariants };
