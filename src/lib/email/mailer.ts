import nodemailer from 'nodemailer'

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null
let smtpVerification: Promise<unknown> | null = null

// Lazily built and cached — avoids re-authenticating with the SMTP server on
// every single call from within the same server process.
function getTransporter() {
  if (transporter) return transporter
  const port = Number(process.env.SMTP_PORT ?? 587)
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS?.replace(/\s+/g, '').trim(),
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
  const currentTransporter = getTransporter()
  if (!smtpVerification) {
    smtpVerification = currentTransporter.verify()
  }
  await smtpVerification
  await currentTransporter.sendMail({
    from: `"OnTask" <${process.env.SMTP_FROM_EMAIL}>`,
    // A real reply-to (rather than only ever sending from a bare "noreply"
    // identity) is one of the few things a transactional sender fully
    // controls that spam filters weigh — defaults to the same inbox if a
    // dedicated one isn't configured.
    replyTo: process.env.SMTP_REPLY_TO || process.env.SMTP_FROM_EMAIL,
    ...options,
  })
}
