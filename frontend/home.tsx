import * as React from 'react';
import { Card } from './lightswind/card.js';
import { ActionLink, Icon, Shell } from './shell.js';

const examples = [
  ['video', 'Send a video', 'Share the original video with a friend when it’s too big to attach to a message.'],
  ['folder', 'Hand off a project', 'Send a presentation or a project ZIP to a teammate while you’re both online.'],
  ['image', 'Share a photo album', 'Put a set of photos in one ZIP and send it to a friend or family member.'],
] as const;

const questions = [
  ['Do both people need to be online?', <>Yes. Keep both browser tabs open until the transfer finishes. The receiver can then select <strong>Save file</strong>.</>],
  ['Do I need an account?', <>You can send or receive a file without signing up. Select <strong>Send a file</strong> to start, or open the invite you received.</>],
  ['How long does an invite link last?', 'An unused invite expires after 10 minutes by default. If it expires, ask the sender for a fresh link.'],
  ['Can I share the same link with more than one person?', 'Each invite is for one recipient and one file. Create a fresh link for each person and send it privately.'],
  ['How big can my file be?', 'PeerDrop has no file-size limit by default. The recipient needs enough free space for the transfer and the saved copy. If a limit applies, you’ll see it when you choose a file.'],
  ['Can I send more than one file?', 'Each link sends one file. Send files separately, or put them in a ZIP and send it as one file.'],
  ['What if I receive an unexpected invite?', <>You’ll see the file’s name and size before accepting. If you weren’t expecting it, select <strong>Decline</strong>.</>],
  ['Can either person cancel a transfer?', <>Yes. Either person can select <strong>Cancel transfer</strong> while it’s active. The recipient can save the file once it arrives in full.</>],
  ['What if the transfer stops?', 'Check that both devices are online. Ask the sender for a new link, then keep both tabs open while you try again.'],
  ['Where does my file go after I save it?', <>Select <strong>Save file</strong>, then check your browser’s downloads or the folder you picked. Save it before closing the transfer tab.</>],
] as const;

function TransferPreview() {
  return <figure className="preview-board" id="transfer-preview" aria-labelledby="preview-title">
    <figcaption id="preview-title">Transfer preview</figcaption>
    <div className="preview-stage">
      <div className="preview-field">
        <div className="preview-orbit" aria-hidden="true" />
        <div className="preview-devices">
          <div className="device">
            <div className="device-icon"><Icon name="laptop" size={92} /></div>
            <p>Sender</p>
          </div>
          <div className="connection" aria-hidden="true">
            <span className="connection-packet" />
          </div>
          <div className="device device-receiver">
            <div className="device-icon"><Icon name="smartphone" size={92} /></div>
            <p>Receiver</p>
          </div>
        </div>
      </div>
      <Card className="preview-file" bordered>
        <div className="preview-file-icon"><Icon name="archive" size={28} /></div>
        <div><strong>project-files.zip</strong><small>24.6 MB</small></div>
        <span className="preview-ready">Ready to receive</span>
      </Card>
    </div>
    <p className="preview-note">Keep both tabs open until the file arrives.</p>
  </figure>;
}

export function Home() {
  return <Shell page="home" title="PeerDrop · Send files from your browser" description="Choose a file and send an invite link. The receiver accepts and saves it, right in their browser.">
    <main id="main" tabIndex={-1}>
      <section className="container hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <h1 id="hero-title">Share files.<br /><em>Just send a link.</em></h1>
          <p className="hero-description">Choose a file in your browser and send an invite. Your recipient opens the link, accepts, and saves the file on their device.</p>
          <div className="hero-actions">
            <ActionLink href="/send">Send a file <Icon name="arrow-right" size={20} /></ActionLink>
            <a className="inline-link" href="/how-it-works">How it works <Icon name="arrow-up-right" size={17} /></a>
          </div>
          <p className="hero-note">One file per invite. No account needed.</p>
        </div>
        <TransferPreview />
      </section>
      <section className="use-cases" aria-labelledby="use-cases-title">
        <div className="container use-cases-layout">
          <h2 id="use-cases-title">When to use PeerDrop</h2>
          <ul role="list">
            {examples.map(([icon, title, description]) => <li key={title}>
              <div className="example-icon"><Icon name={icon} size={35} /></div>
              <div><h3>{title}</h3><p>{description}</p></div>
            </li>)}
          </ul>
        </div>
      </section>
      <section className="container faq" id="faq" tabIndex={-1} aria-labelledby="faq-title">
        <h2 id="faq-title">FAQ</h2>
        <Card className="faq-items" bordered>
          {questions.map(([question, answer]) => <details key={question}>
            <summary>{question}</summary><p>{answer}</p>
          </details>)}
        </Card>
      </section>
    </main>
  </Shell>;
}
