# MikroMail

**Lightweight replacement for Nodemailer, supporting HTML, international symbols, and more**.

![Build Status](https://github.com/mikaelvesavuori/mikromail/workflows/main/badge.svg)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://opensource.org/licenses/MIT)

---

- Supports international symbols
- Supports HTML emails
- Defaults to secure transmission
- Tiny (~4.4 KB gzipped), which is ~13x smaller than Nodemailer
- Zero dependencies

## Usage

### Quick Start

```typescript
import { MikroMail } from 'MikroMail';

const config = {
  user: 'me@mydomain.com',
  password: 'YOUR_PASSWORD_HERE',
  host: 'smtp.email-provider.com'
};

const emailOptions = {
  from: 'me@mydomain.com',
  subject: 'Test Email',
  text: 'Hello!',
  to: 'you@yourdomain.com' // You can also send to multiple recipients: ['sam@acmecorp.cloud', 'sammy@acmecorp.cloud']
};

await new MikroMail({ config }).send(emailOptions);
```

### Bigger example

```typescript
import { MikroMail } from 'MikroMail';

const sender = 'this-is-me@somewhere-over-the-rainbow.cloud';

const config = {
  // Required
  user: sender,
  password: 'YOUR_PASSWORD_HERE',
  host: 'smtp.your-provider.net',
  // Optional - defaults shown
  port: 465,
  secure: true,
  debug: false,
  maxRetries: 2
};

const emailOptions = {
  // Required
  from: sender,
  subject: 'Test Email',
  text: 'Hello, this is a test email! Hallå, MikroMail has international support for, among others, español, français, português, 中文, 日本語, and Русский!',
  to: 'sam.person@somewhere-over-the-rainbow.cloud',
  // Optional
  cc: ['dat.person@somewhere-over-the-rainbow.cloud'],
  bcc: ['hoo.person@somewhere-over-the-rainbow.cloud'],
  html: `
  <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; color: #333; }
        .highlight { color: #0066cc; font-weight: bold; }
      </style>
    </head>
    <body>
      <h1>Hello, this is a test email!</h1>
      <p>Hallå, MikroMail has <span class="highlight">international support</span> for, among others, español, français, português, 中文, 日本語, and Русский!</p>
      <p>It also supports <b>HTML formatting</b> and <i>styling</i>.</p>
    </body>
  </html>
`,
  headers: {
    'X-Priority': '1',
    'X-Custom-Header': 'Custom Value'
  }
};

await new MikroMail({ config }).send(emailOptions);
```

## Testing

Some of the tests require faking an SMTP server. Here we use [Mailpit](https://github.com/axllent/mailpit), which will run a server on `http://localhost:8025`.

- On a Mac, install Mailpit with `brew install mailpit` (assuming you have Homebrew)
- Run Mailpit with `brew services start mailpit`
- Stop Mailpit with `brew services stop mailpit`

## License

MIT. See the `LICENSE` file.
