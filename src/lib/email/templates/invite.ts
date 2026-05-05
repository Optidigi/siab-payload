export function inviteTemplate(opts: { tenantName: string; resetUrl: string; recipientName: string }) {
  return {
    subject: `You've been invited to ${opts.tenantName}`,
    html: `
      <p>Hi ${opts.recipientName},</p>
      <p>You've been added as an editor on <strong>${opts.tenantName}</strong>.</p>
      <p>Set your password and sign in:</p>
      <p><a href="${opts.resetUrl}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;border-radius:6px;text-decoration:none">Set password</a></p>
      <p style="color:#666;font-size:12px">This link expires in 1 hour.</p>
    `
  }
}
