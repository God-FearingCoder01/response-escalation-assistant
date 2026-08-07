# Response & Escalation Assistant (REA) 🚀

[![Vite](https://img.shields.io/badge/Vite-8.2-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![SQLite](https://img.shields.io/badge/SQLite-SQLModel-003B57?logo=sqlite&logoColor=white)](https://sqlmodel.tiangolo.com/)

**Response & Escalation Assistant (REA)** is a modern, high-performance web tool crafted for customer support agents and technical escalation managers. REA streamlines customer communications, standardizes technical escalation templates, and enforces operational quality across support channels.

---

## 🌟 Key Features

### 👤 Multi-Agent Profile System
- **Agent Profiles**: Select your active support profile to automatically bind your credentials, full name, and agent initials across templates.
- **Auto Signatures**: Automatically formats agent initials (`^initials`) for customer replies and agent handles (`#agent_name`) for tech escalations.

### 🔐 System Admin Security PIN Protection
- **4-Digit PIN Security**: Admin profile access is guarded by 4-digit PIN authentication.
- **Server-Verified**: Security PINs are queried asynchronously against the backend database to persist credentials across browser tabs, page refreshes, and devices.
- **PIN Privacy & Customization**: Masked input inputs with custom PIN change utility in the System Admin dashboard.

### ⚡ Tech Escalation Center
- **Telegram Escalations**: Purpose-built builder for technical incident reports and channel escalations.
- **Dual Copy Workflows**:
  - **Copy Telegram Formatted Escalation**: Copies escalation text with attached agent handle (`#agent_name`).
  - **Copy Plain Text Escalation**: Copies clean text without trailing agent handle signature.
- **Dynamic Parameter Inputs**:
  - **Auto-Fill Date Placeholders**: Pre-fills `{day}`, `{month_number}`, `{year}`, and `{date}` from the current system date.
  - **Preset Comboboxes**: Combobox dropdowns for `{time_units}` (`"hour(s)"` / `"minutes"`).

### 💬 Customer Reply Center
- **Category Browser**: Hierarchical filter navigation by primary category and subcategory with live keyword search.
- **Response Formats**:
  - **Signed Format**: Appends agent initials signature (`^initials`).
  - **Unsigned Format**: Clean, customer-facing response text.

### 🛠️ System Admin Dashboard
- **Template Management**: Categorized accordion manager for creating, editing, and deleting templates.
- **Batch Import / Export**: Standardized JSON import and export for team sharing.
- **Template Deduplication ("Clean Duplicates 🧹")**: One-click purge tool to detect and remove duplicate templates while preventing duplicate creation.
- **Agent Roster Management**: Create, update, or remove agent profiles and credentials.

### 🎨 Premium Glassmorphic Design & UX
- **Theme Modes**: Seamless switch between **Night Mode 🌙** and **Day Mode ☀️**.
- **Toast Notifications**: Floating glassmorphic toast confirmations for copy actions (*"Telegram escalation copied! 📋"*, etc.).
- **Custom PNG Asset Icons**: Branded icons (`/admin.png`, `/chat.png`, `/Lightning.png`, `/search.png`, `/signed.png`, `/unsigned.png`, `/telegram.png`, `/lock.png`, `/REA.png`).
- **Collapsible Hover Sidebar**: Minimalist navigation bar with smooth micro-animations.

---

## 🏗️ Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Vanilla CSS tokens system, Lucide glassmorphic UI principles.
- **Backend**: FastAPI, SQLModel, SQLite database (`backend/rea.db`), Pydantic.
- **Deployment**: Vercel Serverless ready (`vercel.json`).

---

## 🛠️ Getting Started

### Prerequisites
- **Node.js** (v18 or higher)
- **Python** (v3.9 or higher)

### 1. Clone Repository & Setup Frontend

```bash
# Clone repository
git clone https://github.com/God-FearingCoder01/response-escalation-assistant.git
cd response-escalation-assistant

# Install Node dependencies
npm install

# Start Vite frontend development server
npm run dev
```

### 2. Setup & Run FastAPI Backend

In a second terminal window:

```bash
# Create and activate Python virtual environment
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

# Install Python backend dependencies
pip install -r backend/requirements.txt

# Start FastAPI server
npm run backend
# Or directly: uvicorn backend.main:app --reload --port 8000
```

The frontend will be available at `http://localhost:5173` and the backend API at `http://localhost:8000`.

---

## 📦 Production Build & Deployment

### Build Frontend
```bash
npm run build
```

### Vercel Deployment
REA is configured out-of-the-box for seamless Vercel deployment with serverless Python API routes:

1. Push your repository to GitHub.
2. Import project into Vercel dashboard.
3. Deploy! Vercel will automatically build the React Vite frontend and serve the FastAPI Python backend endpoints.

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for details.
