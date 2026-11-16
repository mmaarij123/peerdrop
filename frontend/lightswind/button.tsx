import * as React from 'react';
import { cn } from './utils.js';

const variants = {
  default: 'btn-3d-default',
  outline: 'btn-3d-outline',
  unstyled: '',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
}

export function buttonVariants({ variant = 'default', className }: Pick<ButtonProps, 'variant' | 'className'> = {}) {
  return cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
    variants[variant],
    className,
  );
}

export function Button({ variant, className, ...props }: ButtonProps) {
  return <button className={buttonVariants({ variant, className })} {...props} />;
}
