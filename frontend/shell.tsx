import * as React from 'react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { Button, buttonVariants } from './lightswind/button.js';
import { Icon } from './icons.js';

export { Icon } from './icons.js';

export type Page = 'home' | 'guide' | 'privacy' | 'terms' | 'transfer';

export function ActionLink({ className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a className={buttonVariants({ className: `action ${className ?? ''}` })} {...props} />;
}

function Wordmark() {
  return <a className="wordmark" href="/" aria-label="PeerDrop home"><span><Icon name="send" size={27} /></span>PeerDrop</a>;
}

export function Shell({ page, title, description, children }: { page: Page; title: string; description: string; children: ReactNode }) {
  const transfer = page === 'transfer';
  const stay = transfer ? { target: '_blank', rel: 'noopener' } : {};
  return <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="color-scheme" content="light dark" />
      <meta name="theme-color" content="#f8f9fc" />
      <meta name="description" content={description} />
      <title>{title}</title>
      <link rel="icon" href="/mark.svg" type="image/svg+xml" />
      <script src="/motion.js" />
      <link rel="stylesheet" href="/styles.css" />
      {transfer && <><meta name="referrer" content="no-referrer" /><script src="/vendor/peerjs.min.js" defer /><script type="module" src="/transfer.js" /></>}
    </head>
    <body className={`page-${page}`}>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <div className="container header-inner">
          <Wordmark />
          <Button id="theme-toggle" type="button" variant="unstyled" className="theme-toggle" aria-label="Dark mode" aria-pressed={false} hidden>
            <span className="theme-moon"><Icon name="moon" size={23} /></span>
            <span className="theme-sun"><Icon name="sun" size={23} /></span>
          </Button>
        </div>
      </header>
      {children}
      <footer className="site-footer">
        <div className="container footer-inner">
          <Wordmark />
          <nav aria-label="Footer navigation">
            {([
              ['guide', '/how-it-works', 'How it works'],
              ['privacy', '/privacy', 'Privacy Policy'],
              ['terms', '/terms', 'Terms of Service'],
            ] as const).map(([key, href, label]) => <a key={key} href={href} {...stay} aria-current={page === key ? 'page' : undefined} aria-label={transfer ? `${label} (opens in a new tab)` : undefined}>{label}</a>)}
          </nav>
          <p>Made by Maarij</p>
        </div>
      </footer>
      <span className="site-cursor" aria-hidden="true"><Icon name="cursor" size={28} /></span>
    </body>
  </html>;
}
