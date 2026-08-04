# response_esclation_assistant

Usage
-----

This small app helps customer service agents manage and send common responses quickly.

- Templates: Create, edit, and delete reusable message templates from the left-hand panel.
- Placeholders: Use placeholders in templates like `{customer_name}`, `{reference_no}`, `{eta}`.
- Message Builder: Select a template, fill the detected placeholders, and preview the generated message.
- Copy: Use `Copy` to copy the plain message, or `Copy (Telegram MarkdownV2)` to copy an escaped version suitable for Telegram MarkdownV2.
- Persistence: Templates are saved in your browser's `localStorage` under the key `rea_templates_v1`.

Run locally
---------

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

Notes
-----

This is an MVP: templates live in the browser only. If you'd like, I can add JSON import/export or a backend to share templates across agents.
