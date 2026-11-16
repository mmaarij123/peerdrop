import * as React from 'react';
import type { ComponentProps } from 'react';
import { Badge } from './lightswind/badge.js';
import { Button } from './lightswind/button.js';
import { Card } from './lightswind/card.js';
import { ActionLink, Icon, Shell } from './shell.js';

function TransferButton({ variant = 'outline', className, ...props }: ComponentProps<typeof Button>) {
  return <Button type="button" variant={variant} className={`action ${className ?? ''}`} {...props} />;
}

export function Transfer() {
  return <Shell page="transfer" title="File transfer · PeerDrop" description="Send or receive a file with a one-time invite.">
    <main id="main" tabIndex={-1} className="container transfer-page">
      <div className="transfer-layout">
        <h1 id="transfer-title">File transfer</h1>
        <p className="transfer-tip">Keep both browser tabs open until the transfer finishes.</p>
        <section aria-labelledby="transfer-status">
          <Card bordered className="transfer-panel">
            <div className="transfer-status-line">
              <h2 id="transfer-status" aria-live="polite">Getting ready</h2>
              <Badge id="connection-path" className="connection-path" hidden />
            </div>
            <p id="transfer-detail" className="transfer-detail" role="status"></p>

            <div id="file-picker" className="transfer-group" hidden>
              <div id="file-drop-zone" className="file-picker-field">
                <span className="picker-icon"><Icon name="cloud-upload" size={42} /></span>
                <p id="file-drop-hint">Drag a file here</p>
                <label htmlFor="file-input">Choose a file</label>
                <input id="file-input" type="file" aria-describedby="file-drop-hint file-limit" />
                <p id="file-limit"></p>
              </div>
              <TransferButton id="create-link" variant="default" disabled>Create invite link <Icon name="arrow-right" size={20} /></TransferButton>
            </div>
            <div id="file-summary" className="transfer-file" hidden>
              <Icon name="file" size={39} />
              <div><p id="selected-name" className="file-name" dir="auto"></p><p id="selected-size" className="file-detail"></p></div>
            </div>
            <div id="invite" className="transfer-group" hidden>
              <label htmlFor="invite-link">Invite link</label>
              <div className="invite-controls">
                <input id="invite-link" type="text" readOnly spellCheck={false} autoComplete="off" autoCapitalize="off" />
                <TransferButton id="copy-link"><Icon name="copy" size={20} /> Copy link</TransferButton>
              </div>
              <p id="invite-note" className="transfer-detail" role="status"></p>
            </div>
            <div id="progress-group" className="transfer-group" hidden>
              <label id="progress-label" htmlFor="transfer-progress">Progress</label>
              <progress id="transfer-progress" max={100} value={0} />
            </div>
            <div className="transfer-actions">
              <TransferButton id="accept-file" variant="default" hidden>Accept</TransferButton>
              <TransferButton id="decline-file" hidden>Decline</TransferButton>
              <TransferButton id="cancel-transfer" hidden>Cancel transfer</TransferButton>
              <ActionLink id="save-file" download hidden><Icon name="download" size={22} /> Save file</ActionLink>
              <TransferButton id="new-link" variant="default" hidden>Create a fresh link</TransferButton>
              <TransferButton id="new-file" hidden>Choose another file</TransferButton>
            </div>
            <noscript><p>Your browser settings are blocking transfers. Open PeerDrop in another browser to send or receive a file.</p></noscript>
          </Card>
        </section>
        <a className="inline-link transfer-guide" href="/how-it-works" target="_blank" rel="noopener">Transfer guide <Icon name="arrow-up-right" size={17} /></a>
      </div>
    </main>
  </Shell>;
}
