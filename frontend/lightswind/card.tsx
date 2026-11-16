import * as React from 'react';
import { cn } from './utils.js';

type CardProps = React.HTMLAttributes<HTMLDivElement> & { bordered?: boolean };

export function Card({ className, bordered = false, ...props }: CardProps) {
  return <div className={cn(
    'rounded-lg bg-background/70 text-card-foreground shadow-sm',
    bordered ? 'border' : 'border-none',
    'p-0',
    className,
  )} {...props} />;
}
