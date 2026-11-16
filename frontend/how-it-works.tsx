import * as React from 'react';
import { ReadingPage } from './reading-page.js';
import { ActionLink, Icon } from './shell.js';

const contents = [
  ['sending-title', 'Send a file'],
  ['receiving-title', 'Receive and save'],
  ['delivery-title', 'Follow or cancel a transfer'],
  ['limits-title', 'Link expiry and file sizes'],
  ['help-title', 'Troubleshooting'],
] as const;

export function Guide() {
  return <ReadingPage
    page="guide"
    title="How it works"
    description="Learn how to send, accept, and save a file with PeerDrop, and what to do if a transfer stops."
    contents={contents}
    intro={<>
      <h1>How PeerDrop works</h1>
      <p>Share one file with one person. You send a link, they decide whether to accept the file, and you both keep your browser tabs open until the file arrives. Neither person needs an account.</p>
      <ActionLink href="/send">Send a file <Icon name="arrow-right" size={20} /></ActionLink>
    </>}
  >
    <section aria-labelledby="sending-title">
      <h2 id="sending-title">Send a file</h2>
      <ol>
        <li><strong>Choose your file.</strong> Open <strong>Send a file</strong> and drop one file into the outlined area or use the file picker. Then select <strong>Create invite link</strong>.</li>
        <li><strong>Share the full link.</strong> Select <strong>Copy link</strong> and paste it into a private message or email to your recipient. The link lets the person who opens it join the transfer, so share it only with the person you intend to receive the file.</li>
        <li><strong>Keep your tab open.</strong> Once the recipient opens the link and accepts the file, you can watch the progress in your transfer tab.</li>
      </ol>
    </section>

    <section aria-labelledby="receiving-title">
      <h2 id="receiving-title">Receive and save a file</h2>
      <ol>
        <li><strong>Open the invite.</strong> Use the full link from the sender while their transfer tab is open. PeerDrop shows the file name and size when the two tabs connect.</li>
        <li><strong>Accept or decline.</strong> Select <strong>Accept</strong> to start receiving the file or <strong>Decline</strong> to end the transfer. If you were expecting a different file, check with the sender first.</li>
        <li><strong>Save your copy.</strong> Keep your tab open during the transfer. When <strong>Ready to save</strong> appears, select <strong>Save file</strong> and use your browser’s download controls to find the saved copy. Save it before closing the page.</li>
      </ol>
    </section>

    <section aria-labelledby="delivery-title">
      <h2 id="delivery-title">Follow or cancel a transfer</h2>
      <p>Both people can see the progress. When the sender sees <strong>Delivered</strong>, the full file has arrived and the receiver can select <strong>Save file</strong>. PeerDrop doesn’t keep a copy you can download later.</p>
      <p>Either person can select <strong>Cancel transfer</strong> while the transfer is active. A saved copy stays on the receiver’s device.</p>
    </section>

    <section aria-labelledby="limits-title">
      <h2 id="limits-title">When links expire and what you can send</h2>
      <p>Each link is for one file and one receiver. An unused link usually expires after 10 minutes. Once both people have joined, they usually have up to two hours to finish.</p>
      <p>PeerDrop has no file-size limit by default. Large transfers depend on the receiver’s available space and browser. If your PeerDrop site sets a size limit, you’ll see it when you choose a file. To send several files together, put them in one ZIP file before creating the link.</p>
    </section>

    <section aria-labelledby="help-title">
      <h2 id="help-title">If a transfer doesn’t work</h2>
      <ul>
        <li><strong>The link is expired or already used.</strong> Ask the sender to select <strong>Create a fresh link</strong> and share it with you.</li>
        <li><strong>The transfer is stuck or the connection dropped.</strong> Check that both people are online and the sender’s transfer tab is still open. If the attempt ended or someone closed their tab, use a fresh link to start again.</li>
        <li><strong>The file is too large for the receiver.</strong> Try freeing space on their device or sending a smaller file with a new link. The sender can use <strong>Choose another file</strong> after an attempt ends.</li>
      </ul>
    </section>
  </ReadingPage>;
}
