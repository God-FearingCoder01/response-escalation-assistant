# Response & Escalation Assistant (REA) 🚀

[![Vite](https://img.shields.io/badge/Vite-8.2-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![SQLite](https://img.shields.io/badge/SQLite-SQLModel-003B57?logo=sqlite&logoColor=white)](https://sqlmodel.tiangolo.com/)

**Response & Escalation Assistant (REA)** is a modern, high-performance, multi-tenant web application crafted for customer support agents and technical escalation managers. REA streamlines customer communications, standardizes technical escalation templates, enforces operational quality, and supports multiple isolated organization spaces concurrently.

---

## 🌟 Key Features

### 🏢 Multi-Tenant Architecture & Dedicated Organization URLs
- **Dedicated Organization Endpoints**: Each company operates in its own dedicated space accessed via a custom URL ending (`/{company_name}`, e.g., `/winbucks`, `/corp-a`).
- **Complete Tenant Isolation**: Templates, agent rosters, suggestions, usage history, and favorites are strictly isolated per company via database foreign keys (`company_id`).
- **Fixed Company Workspace**: Once inside an organization's space, agents work indefinitely within that company environment without inline organization switching.
- **Default Organization**: Initial system startup automatically seeds `Corp A` (`/corp-a`) with starter escalation templates and agent profiles (`SA` System Administrator and `CW` Chris Whyt).

### 🏢 Super Admin Dashboard (`/monitor`)
- **Protected Access**: Guarded by 4-digit PIN authentication with email recovery (`gfc.dev@proton.me`).
- **Automatic PIN Re-authentication**: Re-verifies PIN security whenever navigating to `/monitor`.
- **Organization Management**:
  - **Create Organizations**: Provision new company spaces with custom names and URL slugs.
  - **Edit Organization Details**: Update company names and URL slugs dynamically.
  - **Active / Inactive Protection**: Toggle company space status. Deactivated companies render a full-page inactive notice preventing access.
  - **Company Admin PIN Reset**: Super Admin can reset admin PINs for any company's administrator profiles.
  - **Super Admin Credentials**: Update Super Admin registered email and 4-digit PIN anytime.
- **Root Portal Navigation**: Includes a **🏠 Root Portal (/)** button to return directly to the main landing portal.

### 🌐 Public Developer & Support Landing Portal (`/`)
- **System Portal on Root**: Accessing `/` or unrecognized URLs displays the clean Developer & System Support Portal.
- **Privacy Enforcement**: Registered organization lists are kept private from public display.
- **Support Contact**: Quick email link (`gfc.dev@proton.me`) and copy utility to contact the lead developer for custom company URL endpoints.
- **Day & Night Mode Support**: Integrated theme switcher for Day Mode ☀️ and Night Mode 🌙.

### 👤 Multi-Agent Profile System
- **Agent Profiles**: Select active support profile to automatically bind credentials, full name, and agent initials across templates.
- **Auto Signatures**: Automatically formats agent initials (`^initials`) for customer replies and agent handles (`#agent_name`) for tech escalations.

### 🔐 System Admin Security PIN Protection
- **4-Digit PIN Security**: Admin profile access within company spaces is guarded by 4-digit PIN authentication.
- **Server-Verified**: Security PINs are queried asynchronously against the backend database to persist credentials across browser tabs, page refreshes, and devices.

### ⚡ Tech Escalation Center
- **Telegram Escalations**: Purpose-built builder for technical incident reports and channel escalations.
- **Dual Copy Workflows**:
  - **Copy Telegram Formatted Escalation**: Copies escalation text with attached agent handle (`#agent_name`).
  - **Copy Plain Text Escalation**: Copies clean text without trailing agent handle signature.
- **Dynamic Parameter Inputs**:
  - **Auto-Fill Date Placeholders**: Pre-fills `{day}`, `{month_number}`, `{year}`, and `{date}` from system date.
  - **Preset Comboboxes**: Combobox dropdowns for `{time_units}` (`"hour(s)"` / `"minutes"`).

### 💬 Customer Reply Center
- **Category Browser**: Hierarchical filter navigation by primary category and subcategory with live keyword search.
- **Response Formats**:
  - **Signed Format**: Appends agent initials signature (`^initials`).
  - **Unsigned Format**: Clean, customer-facing response text.

### 🛠️ Company Admin Dashboard
- **Template Management**: Categorized accordion manager for creating, editing, and deleting company-specific templates.
- **Batch Import / Export**: Standardized JSON import and export for team sharing.
- **Template Deduplication ("Clean Duplicates 🧹")**: One-click purge tool to detect and remove duplicate templates.
- **Agent Roster Management**: Create, update, or remove agent profiles and credentials for the company.

### 🎨 Premium Glassmorphic Design & UX
- **Theme Modes**: Seamless switch between **Night Mode 🌙** and **Day Mode ☀️** across all pages and dashboards.
- **Toast Notifications**: Floating glassmorphic toast confirmations for copy actions (*"Telegram escalation copied! 📋"*, etc.).
- **Branded Assets**: Branded icons (`/admin.png`, `/chat.png`, `/Lightning.png`, `/search.png`, `/signed.png`, `/unsigned.png`, `/telegram.png`, `/lock.png`, `/REA.png`).
- **Collapsible Hover Sidebar**: Minimalist navigation bar with smooth micro-animations.

---

## 🏗️ Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Vanilla CSS tokens system, Lucide glassmorphic UI principles.
- **Backend**: FastAPI, SQLModel, SQLite database (`backend/rea.db`), Pydantic.
- **Testing**: Pytest automated backend test suite (`backend/test_multitenancy.py`, `backend/test_superadmin.py`).
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

# Run automated tests
pytest backend/test_multitenancy.py backend/test_superadmin.py

# Start FastAPI server
npm run backend
# Or directly: uvicorn backend.main:app --reload --port 8000
```

The frontend will be available at `http://localhost:5173` and the backend API at `http://localhost:8000`.

---

## 📍 Key URL Routes

| Path | Screen / Description | Access / Protection |
| :--- | :--- | :--- |
| `/` | **Developer & System Support Portal** | Public root portal with contact info & theme toggle. |
| `/{company_slug}` | **Organization Space** (e.g. `/corp-a`, `/winbucks`) | Dedicated tenant workspace for agents and company admins. |
| `/monitor` | **Super Admin Dashboard** | Multi-tenant management, PIN reset, & org creation (Guarded by 4-digit PIN). |

---

## 📦 Production Build & Deployment

### Build & Typecheck Frontend
```bash
npm run check
```

### Vercel Deployment
REA is configured out-of-the-box for seamless Vercel deployment with serverless Python API routes:

1. Push your repository to GitHub.
2. Import project into Vercel dashboard.
3. Deploy! Vercel will automatically build the React Vite frontend and serve the FastAPI Python backend endpoints.

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for details.
