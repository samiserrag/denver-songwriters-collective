/**
 * Collaborator Added Email Template
 *
 * Sent when a user is added as a collaborator on a gallery album.
 *
 * Tone: Friendly, informative — the user now appears on the album.
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

export interface CollaboratorAddedEmailParams {
  collaboratorName: string;
  albumName: string;
  albumSlug: string;
}

export function getCollaboratorAddedEmail(params: CollaboratorAddedEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { collaboratorName, albumName, albumSlug } = params;
  const safeAlbumName = escapeHtml(albumName);

  const subject = `You were added as a collaborator: ${albumName} — The Colorado Songwriters Collective`;

  const albumLink = `${SITE_URL}/gallery/${albumSlug}`;

  const htmlContent = `
${paragraph(getGreeting(collaboratorName))}

${paragraph(`You've been added as a collaborator on a gallery album on The Colorado Songwriters Collective!`)}

${neutralBox("📸", safeAlbumName)}

${paragraph("As a collaborator, this album will appear on your public profile so visitors can see your work.")}

${createButton("View Album", albumLink, "green")}
`;

  const html = wrapEmailHtml(htmlContent);

  const textContent = `${getGreeting(collaboratorName)}

You've been added as a collaborator on a gallery album on The Colorado Songwriters Collective!

${albumName}

As a collaborator, this album will appear on your public profile so visitors can see your work.

View Album: ${albumLink}`;

  const text = wrapEmailText(textContent);

  return { subject, html, text };
}
