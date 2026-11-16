import * as React from 'react';
import { ReadingPage } from './reading-page.js';

const contents = [
  ['using-peerdrop', 'Using PeerDrop'],
  ['transfers', 'Sending and receiving'],
  ['files', 'Rights to your files'],
  ['acceptable-use', 'Acceptable use'],
  ['availability', 'Availability and your rights'],
  ['privacy', 'Privacy and related services'],
  ['reporting', 'Questions and reports'],
  ['changes', 'Changes to these terms'],
] as const;

export function Terms() {
  return <ReadingPage
    page="terms"
    title="Terms of Service"
    description="Read PeerDrop’s terms for file transfers, acceptable use, service limits, and reporting problems."
    contents={contents}
    intro={<>
      <h1>Terms of Service</h1>
      <p>Draft · Last updated <time dateTime="2026-11-14">November 14, 2026</time></p>
      <p>These draft terms describe the rules for visiting PeerDrop and using it to send or receive a file. The operator’s legal name and contact details will be added before publication.</p>
    </>}
  >
    <section id="using-peerdrop">
      <h2>Using PeerDrop</h2>
      <p>PeerDrop lets you share a file with one person through an invite link. You can send or receive without an account. Use PeerDrop only if you can lawfully use it where you are. If you act for an organization, make sure you have its permission to use the service and share its files.</p>
      <p>These terms cover PeerDrop’s website and transfer features. Follow any separate rules that apply to the devices, internet connection, or messaging service you use with PeerDrop.</p>
    </section>

    <section id="transfers">
      <h2>Sending and receiving</h2>
      <ul>
        <li><strong>Share the invite privately.</strong> Each link is for one file and one recipient. Anyone with the full link can try to join as the recipient, so check who you are sending it to. If a link reaches the wrong person while the transfer is open, cancel it and make a fresh link.</li>
        <li><strong>Check before accepting.</strong> The recipient sees the file name and size before accepting. Only accept files you expect from someone you trust. If you have doubts about a file, check with the sender or decline it.</li>
        <li><strong>Keep both tabs open.</strong> By default, an unused invite expires after 10 minutes. Once both people join, they have up to two hours by default to finish. Either person can cancel while a transfer is in progress. If it ends early, the sender needs a fresh link to try again.</li>
        <li><strong>Save the finished file.</strong> The recipient can save their copy once the full file arrives. Save it before closing the page. Keep your own copy of important files. PeerDrop doesn’t provide a stored copy that you can download later.</li>
      </ul>
      <p>What size file you can send and whether it arrives depend on the browser, available space on the recipient’s device, and both people’s connections. A particular PeerDrop site may set a size limit or restrict how often you can create or join an invite.</p>
    </section>

    <section id="files">
      <h2>Rights to your files</h2>
      <p>You keep any rights you already have in a file. When you choose to send it, you ask PeerDrop to help your browser transfer it to the recipient you invite.</p>
      <p>Send files only if you are allowed to share them with that recipient. Get any permissions required for personal, confidential, or copyrighted material. Follow any conditions that apply to how you receive, keep, or share someone else’s file.</p>
      <p>The recipient controls any copy they save, even if you later try to cancel the transfer.</p>
    </section>

    <section id="acceptable-use">
      <h2>Acceptable use</h2>
      <p>Use the service lawfully and respect other people’s rights.</p>
      <ul>
        <li>Do not send harmful software or files intended to damage devices, steal information, or trick people into disclosing passwords or payments.</li>
        <li>Do not send unlawful material, use transfers to harass or threaten anyone, or share other people’s private or confidential information without permission.</li>
        <li>Do not use PeerDrop for spam, impersonation, or fraud.</li>
        <li>Do not access someone else’s transfer without permission, interfere with the service, or try to bypass limits and access controls.</li>
      </ul>
    </section>

    <section id="availability">
      <h2>Availability and your rights</h2>
      <p>Transfers can be interrupted by a connection problem, a device or browser issue, or a service outage. The operator may limit access, stop a transfer, or pause the service for maintenance, to protect people and the service, or to meet legal obligations.</p>
      <p>You keep any consumer protections, remedies, and other rights that apply under mandatory law.</p>
    </section>

    <section id="privacy">
      <h2>Privacy and related services</h2>
      <p>See the <a href="/privacy">Privacy Policy</a> for how PeerDrop handles files, links, connection information, and temporary copies. If you copy an invite into an email or chat, the service you use to share it may handle that message under its own privacy policy and terms.</p>
    </section>

    <section id="reporting">
      <h2>Questions and reports</h2>
      <p>For help with an expired invite, a dropped connection, or a file that won’t save, see <a href="/how-it-works#help-title">How it works</a>. You can decline an unexpected file before the transfer starts.</p>
      <p>The operator’s contact details for support, abuse, and copyright reports will appear here before publication. If you report a problem, include a short description and when it happened. Keep the file and full invite link private.</p>
    </section>

    <section id="changes">
      <h2>Changes to these terms</h2>
      <p>Updated terms will be posted on this page with the date they take effect. The operator will provide notice of material changes as required by applicable law.</p>
    </section>
  </ReadingPage>;
}
