// workspaceName/inviterName/message all trace back to user-entered text
// (workspace name, invite message) — escaped before landing in the HTML so
// none of it can break out into markup in the recipient's inbox.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Table-based layout with inline styles throughout — email clients don't
// reliably support external stylesheets or flexbox/grid, so this sticks to
// the lowest common denominator that still renders consistently (Gmail,
// Outlook, Apple Mail). Colors mirror the app's own palette (see
// tailwind.config.js) since Tailwind classes themselves don't apply here.
export function buildInvitationEmail({
  workspaceName,
  inviterName,
  message,
  invitedEmail,
  acceptUrl,
}: {
  workspaceName: string
  inviterName: string
  message: string | null
  invitedEmail: string
  acceptUrl: string
}) {
  const safeWorkspaceName = escapeHtml(workspaceName)
  const safeInviterName = escapeHtml(inviterName)
  const safeMessage = message ? escapeHtml(message) : null
  const safeInvitedEmail = escapeHtml(invitedEmail)

  // Subject is a mail header, not HTML — strip newlines rather than
  // HTML-escape, so a crafted workspace name can't inject extra headers.
  const stripNewlines = (value: string) => value.replace(/[\r\n]+/g, ' ')
  const subject = `${stripNewlines(inviterName)} invited you to join "${stripNewlines(workspaceName)}" on OnTask`

  const messageBlock = safeMessage
    ? `
      <tr>
        <td style="padding: 0 40px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #eef3ee; border-radius: 12px;">
            <tr>
              <td style="padding: 16px 20px; font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 20px; color: #375b4b; font-style: italic;">
                &ldquo;${safeMessage}&rdquo;
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : ''

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background: #f5f6f1;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f5f6f1; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width: 560px; width: 100%; background: #fffefa; border-radius: 20px; border: 1px solid #dfe4dc; overflow: hidden;">
          <tr>
            <td style="background: #375b4b; padding: 28px 40px;">
              <span style="font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: 800; color: #ffffff; letter-spacing: 0.02em;">
                OnTask
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 40px 8px;">
              <p style="margin: 0 0 10px; font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #e17d5c;">
                You&rsquo;ve been invited
              </p>
              <h1 style="margin: 0 0 16px; font-family: Arial, Helvetica, sans-serif; font-size: 24px; line-height: 32px; font-weight: 800; color: #18221f;">
                Join &ldquo;${safeWorkspaceName}&rdquo; on OnTask
              </h1>
              <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 22px; color: #78827c;">
                <strong style="color: #18221f;">${safeInviterName}</strong> invited you to collaborate on tasks and track focus time together in this shared workspace.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px 8px;">&nbsp;</td>
          </tr>
          ${messageBlock}
          <tr>
            <td style="padding: 0 40px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius: 10px; background: #375b4b;">
                    <a href="${acceptUrl}" style="display: inline-block; padding: 13px 28px; font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: 700; color: #ffffff; text-decoration: none;">
                      View invitation
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 36px; border-top: 1px solid #dfe4dc; padding-top: 20px;">
              <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 19px; color: #78827c;">
                Sign in with <strong style="color: #18221f;">${safeInvitedEmail}</strong> to see this invitation on your Shared Workspaces page. This invitation expires in 14 days. If you weren&rsquo;t expecting this, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin: 20px 0 0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #78827c;">
          Sent by OnTask &middot; Focused work, without the noise.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = [
    `${inviterName} invited you to join "${workspaceName}" on OnTask.`,
    message ? `Message: "${message}"` : null,
    `Sign in with ${invitedEmail} to see this invitation: ${acceptUrl}`,
    `This invitation expires in 14 days.`,
  ]
    .filter(Boolean)
    .join('\n\n')

  return { subject, html, text }
}
