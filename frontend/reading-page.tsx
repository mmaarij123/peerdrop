import * as React from 'react';
import type { ReactNode } from 'react';
import { Card } from './lightswind/card.js';
import { Shell, type Page } from './shell.js';

interface ReadingPageProps {
  page: Extract<Page, 'guide' | 'privacy' | 'terms'>;
  title: string;
  description: string;
  intro: ReactNode;
  contents: readonly (readonly [id: string, label: string])[];
  children: ReactNode;
}

export function ReadingPage({ page, title, description, intro, contents, children }: ReadingPageProps) {
  return <Shell page={page} title={`${title} · PeerDrop`} description={description}>
    <main id="main" className="container reading-page" tabIndex={-1}>
      <div className="reading-intro">{intro}</div>
      <div className="reading-layout">
        <nav className="policy-contents" aria-labelledby="contents-label">
          <p id="contents-label">On this page</p>
          <ul>{contents.map(([id, label]) => <li key={id}><a href={`#${id}`}>{label}</a></li>)}</ul>
        </nav>
        <Card bordered className="reading-content">{children}</Card>
      </div>
    </main>
  </Shell>;
}
