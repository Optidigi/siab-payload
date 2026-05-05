export function resetPasswordTemplate(opts: { resetUrl: string }) {
  return {
    subject: "Reset your password",
    html: `
      <p>Click to reset your password:</p>
      <p><a href="${opts.resetUrl}">${opts.resetUrl}</a></p>
      <p style="color:#666;font-size:12px">If you didn't request this, ignore this email.</p>
    `
  }
}
