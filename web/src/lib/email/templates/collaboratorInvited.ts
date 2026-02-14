/**
 * Collaborator Invited Email Template
 *
 * Sent when a user is invited to collaborate on a gallery album.
 * Includes Preview, Accept, and Decline action buttons.
 *
 * Tone: Friendly, informative — the user is being asked to opt in.
 */

import { escapeHtml } from "@/lib/highlight";
import {
  wrapEmailHtml,
  wrapEmailText,
  getGreeting,
  paragraph,
  createButton,
  neutralBox,
  SITE_URL,
} from "../render";

export interface CollaboratorInvitedEmailParams {
  inviteeName: string;
  actorName: string;
  albumName: string;
  albumSlug: string;
  albumId: string;
}

export function getCollaboratorInvitedEmail(params: CollaboratorInvitedEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { inviteeName, actorName, albumName, albumSlug, albumId } = params;
  const safeAlbumName = escapeHtml(albumName);
  const safeActorName = escapeHtml(actorName);

  const subject = `You're invited to collaborate: ${albumName} — The Colorado Songwriters Collective`;

  const previewLink = `${SITE_URL}/gallery/${albumSlug}?invite=1`;
  const acceptLink = `${SITE_URL}/gallery/${albumSlug}?albumId=${albumId}&action=accept`;
  const declineLink = `${SITE_URL}/gallery/${albumSlug}?albumId=${albumId}&action=decline`;

  const htmlContent = `
${paragraph(getGreeting(inviteeName))}

${paragraph(`<strong>${safeActorName}</strong> invited you to collaborate on a gallery album on The Colorado Songwriters Collective.`)}

${neutralBox("📸", safeAlbumName)}

${paragraph("If you accept, this album will appear on your public profile so visitors can see your work. You can always remove yourself later.")}

${createButton("Preview Album", previewLink)}

<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 16px auto; text-align: center;">
  <tr>
    <td style="padding: 0 8px;">
      ${createButton("Accept", acceptLink, "green")}
    </td>
    <td style="padding: 0 8px;">
      ${createButton("Decline", declineLink)}
    </td>
  </tr>
</table>
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${getGreeting(inviteeName)}

${actorName} invited you to collaborate on a gallery album on The Colorado Songwriters Collective.

${albumName}

If you accept, this album will appear on your public profile so visitors can see your work. You can always remove yourself later.

Preview Album: ${previewLink}
Accept: ${acceptLink}
Decline: ${declineLink}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
