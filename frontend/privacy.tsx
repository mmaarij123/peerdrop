import * as React from 'react';
import { ReadingPage } from './reading-page.js';

const contents = [
  ['files-and-invites', 'Files and invites'],
  ['service-data', 'Information we use'],
  ['who-receives-data', 'Who receives information'],
  ['retention', 'How long it is kept'],
  ['browser-storage', 'Browser storage and cookies'],
  ['privacy-rights', 'Your choices and rights'],
  ['privacy-contact', 'Contact and policy changes'],
] as const;

export function Privacy() {
  return <ReadingPage
    page="privacy"
    title="Privacy Policy"
    description="How PeerDrop handles files, invite links, and connection information."
    contents={contents}
    intro={<>
      <h1>Privacy Policy</h1>
      <p>Draft · Last updated <time dateTime="2026-11-14">November 14, 2026</time></p>
      <p>This policy explains what information PeerDrop uses when you visit the site, send a file, or open an invite. You can share a file without an account. PeerDrop keeps no copy of the file on its servers.</p>
    </>}
  >
    <section id="files-and-invites">
      <h2>Files and invites</h2>
      <p>When the browsers connect, the sender’s browser shares the file name, size, and type with the recipient’s browser. The recipient sees the name and size before deciding whether to accept. The browser sends the contents only after the recipient accepts. Encryption protects the file and its details while they travel between the two browsers.</p>
      <p>Each invite admits one recipient. Anyone with the full link can try to join, so send it privately. PeerDrop uses separate access codes to let the sender and recipient join. After the transfer, the recipient decides whether to save or share the file. Any saved copy stays under the recipient’s control.</p>
    </section>

    <section id="service-data">
      <h2>Information PeerDrop uses</h2>
      <ul>
        <li><strong>Connection information.</strong> When you open the site, your browser sends a request that includes your network address (IP address) and the page you asked for. During a transfer, PeerDrop passes connection details between the browsers so they can find and connect to each other. Those details may include network addresses.</li>
        <li><strong>Invite information.</strong> PeerDrop creates a random transfer identifier and access codes. It uses these to admit one sender and one recipient and to recognize the outcome, such as completion, cancellation, or expiry. The app keeps protected versions of the invite codes in its transfer records.</li>
        <li><strong>Attempt counts.</strong> PeerDrop uses the network address to limit repeated attempts to create or join invites and help prevent abuse. If servers share those counts, the shared store uses a protected version of the address.</li>
      </ul>
    </section>

    <section id="who-receives-data">
      <h2>Who receives information</h2>
      <ul>
        <li><strong>The other participant.</strong> The browsers exchange connection information. The recipient gets the file details, then receives the file if they accept.</li>
        <li><strong>Hosting and connection providers.</strong> The web host processes requests for the site. If PeerDrop uses a service to help a browser find its network address, that service can see the address even when the file travels directly between browsers. A service that forwards encrypted transfer traffic can see the network addresses and the amount of data sent. The providers, their locations, and logging practices depend on the deployment.</li>
        <li><strong>Services you choose.</strong> When you share an invite by email, chat, or another service, that service handles the link under its own privacy policy.</li>
      </ul>
      <p>The operator may have to disclose information it holds if the law requires it.</p>
    </section>

    <section id="retention">
      <h2>How long information is kept</h2>
      <ul>
        <li><strong>Active invites and transfers.</strong> By default, an unused invite expires after 10 minutes. Once both participants join, they have up to two hours. PeerDrop removes the active record when the transfer ends.</li>
        <li><strong>Ended invites.</strong> PeerDrop keeps the transfer identifier, protected access codes, and outcome for up to 10 more minutes so it can recognize a used or expired link.</li>
        <li><strong>Attempt counts.</strong> Counts for creating or joining invites expire after one minute by default.</li>
      </ul>
      <p>These periods apply to PeerDrop’s own records. The app’s request logging is off by default. Hosting and connection providers may keep their own service records, depending on the deployment.</p>
    </section>

    <section id="browser-storage">
      <h2>Browser storage and cookies</h2>
      <p>The recipient’s browser holds received data while the transfer page is open. For larger files, it uses temporary space on the device. PeerDrop asks the browser to clear this data when a transfer fails or is cancelled, or when the recipient leaves the transfer page. After an unexpected browser closure, a later large transfer may clear leftover files in supported browsers.</p>
      <p>Select <strong>Save file</strong> to keep a separate copy. You can clear temporary files through your browser’s settings for this site. Save any completed transfer you want to keep before clearing site data.</p>
      <p>The PeerDrop app works without cookies, analytics, or advertising trackers.</p>
      <p>If you switch between light and dark mode, PeerDrop saves your choice in this browser so it can use it on your next visit. Clearing this site’s data resets that choice.</p>
    </section>

    <section id="privacy-rights">
      <h2>Your choices and privacy rights</h2>
      <p>The recipient can decline a file, and either participant can cancel an active transfer. The sender can keep the invite private. Both people can remove any saved copies they control and clear temporary site data from their own browser.</p>
      <p>Depending on the law that applies, you may be able to ask for access to personal information, request correction or deletion, restrict or object to its use, request a copy in a reusable format, or complain to the relevant privacy authority. PeerDrop has no account profiles, and its invite records expire quickly. That can affect what the operator still holds or can link to a person.</p>
    </section>

    <section id="privacy-contact">
      <h2>Contact and policy changes</h2>
      <p>The operator’s name, contact for privacy questions and requests, and details about the services used to host this site will be added before public release.</p>
      <p>Updates to this policy will appear on this page with a new revision date.</p>
    </section>
  </ReadingPage>;
}
