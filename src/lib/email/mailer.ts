import nodemailer from 'nodemailer'

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null

// Lazily built and cached — avoids re-authenticating with the SMTP server on
// every single call from within the same server process.
function getTransporter() {
  if (transporter) return transporter
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
  return transporter
}

export async function sendMail(options: {
  to: string
  subject: string
  html: string
  text: string
}) {
  await getTransporter().sendMail({
    from: `"OnTask" <${process.env.SMTP_FROM_EMAIL}>`,
    ...options,
  })
}
