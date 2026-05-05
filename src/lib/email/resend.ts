import { Resend } from "resend"

let client: Resend | null = null

export function resendClient(): Resend {
  if (!client) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY missing — cannot send email")
    }
    client = new Resend(process.env.RESEND_API_KEY)
  }
  return client
}

export async function sendEmail(opts: { to: string; subject: string; html: string }) {
  const r = resendClient()
  const result = await r.emails.send({
    from: process.env.EMAIL_FROM || "noreply@siteinabox.nl",
    to: opts.to,
    subject: opts.subject,
    html: opts.html
  })
  if (result.error) throw new Error(`Resend: ${result.error.message}`)
  return result.data
}
