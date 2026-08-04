# response_esclation_assistant

Usage
-----

This small app helps customer service agents manage and send common responses quickly.

- Templates: Create, edit, and delete reusable message templates from the left-hand panel.
- Placeholders: Use placeholders in templates like `{customer_name}`, `{reference_no}`, `{eta}`.
- Message Builder: Select a template, fill the detected placeholders, and preview the generated message.
- Copy: Use `Copy` to copy the plain message, or `Copy (Telegram MarkdownV2)` to copy an escaped version suitable for Telegram MarkdownV2.
- Persistence: Templates are stored in the FastAPI + SQLite backend.

Run locally
---------

Start the backend and the frontend in two terminals:

```bash
npm install
npm run dev
```

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

If the API is running on a different URL, set `VITE_API_URL` before starting Vite:

```bash
export VITE_API_URL=http://localhost:8000
npm run dev
```

Build for production:

```bash
npm run build
```

Notes
-----

This is an MVP: templates live in the browser only. If you'd like, I can add JSON import/export or a backend to share templates across agents.
