# Design and accessibility

## Foundations

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--paper` | `#F8F9FC` | `#14161D` | Page background |
| `--surface` | `#FFFFFF` | `#1C202B` | Header, footer, and panels |
| `--ink` | `#171D2D` | `#F3F5FB` | Primary text |
| `--muted` | `#505B72` | `#ADB8CE` | Supporting copy and metadata |
| `--accent` | `#234DCF` | `#A4BAFF` | Links, focus outlines, and preview motion |
| `--primary` | `#244DD4` | `#A8BBFF` | Primary action fill |
| `--field` | `#EEF1FC` | `#22283A` | Preview field and file picker |
| `--line` | `#DCE1EC` | `#343B4E` | Separators and panel borders |

Use the local Geist variable font and fall back to the system sans-serif. Use strong heading weights and readable body line heights. Keep the content within 1,200 px and use the responsive gutters in [styles.css](../frontend/styles.css). The hero pairs copy with the preview and stacks at 760 px. Present use cases as a divided list, with the section title beside it on wider screens.

## Component patterns

- The header contains the paper-plane wordmark and theme toggle. Each footer shows the wordmark, links to How it works, Privacy Policy and Terms of Service, and the credit **Made by Maarij**.
- Put the sun and moon theme toggle in the shared header. Follow the device theme until the visitor makes a choice. Remember that choice in the browser and apply it before the page draws. Use the shared theme tokens for navigation, cards, form controls, and status text.
- Center the send and receive pages around one transfer panel. Open reference links from transfer pages in a separate tab. The guide and legal pages use a bordered reading column and a contents rail that stacks above it on mobile.
- Give longer legal pages an in-page contents list whose links match the section headings. Keep the text readable at 320 px and clearly mark draft policies.
- Use the solid blue **Send a file** action to open `/send` and a text link to open the guide. Keep the button in place on hover and shift only its color and arrow. Use locally generated Kubai Icons SVGs for the wordmark, devices, file examples, and action icons. Animate the artwork on pointer hover when motion is enabled.
- In the landing preview, loop a blue pulse from sender to receiver, briefly highlight its arrival, and drift the dotted background while the panel is visible. Pause all three effects when the panel leaves view or the tab is hidden. Keep the device labels, example filename, and reminder to keep both tabs open legible at 320 px.
- Use an unordered list for the landing examples, ordered lists for the guide's steps, and native `details` and `summary` for FAQ questions. On wider screens, put the large FAQ heading on the left and the questions and answers on the right. Stack them at 650 px and below. Where supported, animate the answer opening and closing when motion is enabled. Hide decorative icons from assistive technology when text already supplies the meaning.
- Reuse the panel, file icon, and button patterns on the transfer screens. Show the filename and size before consent. Use separate Accept and Decline controls. Show progress as bytes and percentage, with **Delivered** reserved for acknowledged receipt. Offer Save file only after completion. Show **Direct connection** or **Assisted connection** when the browser can identify which one is in use.
- Highlight the sender's file picker while a file is dragged over it. Both dropping and browsing select one file for **Create invite link**. Display the selected name in the native picker and use the status region for invalid drops.
- Show the invite in a labeled, read-only field after the sender joins signaling. If clipboard access fails, select the link for manual copying. After a terminal outcome, let the sender retry with the same file or choose another. Give the receiver focus on Save file when the download is ready.
- Distinguish invite throttling from temporary service unavailability. When the server supplies a retry delay, display it in the existing status panel.
- Show a numeric file-size cap only when one is configured. Otherwise explain that large transfers depend on the receiver's available space.
- When a transfer fails, explain what the person can do next in the existing status panel. Describe actions and outcomes in ordinary language, including in the FAQ and guide.
- When a file is offered, ask the receiver **Accept this file?** and tell the sender the receiver still needs to decide.

## Accessibility checks

- Preserve the skip link, meaningful landmarks, heading order, and keyboard operation. Show visible focus on interactive controls. Keep the main and FAQ landmarks focusable for fragment navigation, with no outline around the whole section. Make tap targets at least 44 px tall.
- Convey meaning with text as well as color. Keep status changes in a live status region and associate the byte count with the progress bar. Check text and focus contrast when changing color tokens.
- Keep page entrances and control feedback brief. Enable smooth scrolling and motion only when the visitor has expressed no preference for reduced motion.
- Use the glowing Kubai pointer only with a mouse and a fine, hover-capable primary pointer. Position its tip at the click point, brighten the glow over controls, and shrink the arrow briefly on press. Use the native cursor on inputs and disabled controls and in reduced-motion or forced-colors mode. Restore the native cursor on keyboard activity, tab deactivation, and pointer exit.

## References

PeerDrop uses locally vendored Lightswind Button, Card, and Badge components. Their theme and layout rules live in [styles.css](../frontend/styles.css). Kubai SVG artwork is embedded in the generated pages. [Lightswind UI](https://lightswind.com/components/introduction) · [Kubai Icons](https://github.com/kubai087/kubai-icons)

The redesign takes its pared-back navigation and focused hierarchy from the minimalist design gallery. [Dribbble minimalist UI designs](https://dribbble.com/search/minimalist-ui-design) · [Provantage by six2eight](https://dribbble.com/shots/25288689-Business-consultation-website-homepage-design)
