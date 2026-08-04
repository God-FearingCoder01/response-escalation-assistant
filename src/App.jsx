import { useEffect, useState } from "react";

const zones = [
  { label: "UTC", zone: "UTC" },
  { label: "New York (ET)", zone: "America/New_York" },
  { label: "London", zone: "Europe/London" },
  { label: "Dubai", zone: "Asia/Dubai" },
  { label: "Tokyo", zone: "Asia/Tokyo" }
];

const customerTemplates = [
  { id: 1, name: "Withdrawal Delay", body: "Hi {customer_name}, your withdrawal {reference_no} is under review. ETA: {eta}." },
  { id: 2, name: "KYC Pending", body: "Hi {customer_name}, your account verification is still pending. Please upload: {required_docs}." },
  { id: 3, name: "Bonus Not Received", body: "Hi {customer_name}, we checked your bonus request for promo {promo_code}. Status: {status}." }
];

export default function App() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-cyan-400">
          Response & Escalation Assistant
        </h1>
        <p className="text-slate-400 mt-1">
          Starter workspace (React + Tailwind + CI)
        </p>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h2 className="font-semibold mb-3">Templates</h2>
          <ul className="space-y-2">
            {customerTemplates.map((t) => (
              <li
                key={t.id}
                className="p-3 rounded-lg border border-slate-800 bg-slate-950"
              >
                <div className="font-medium">{t.name}</div>
                <div className="text-sm text-slate-400 mt-1 line-clamp-2">{t.body}</div>
              </li>
            ))}
          </ul>
        </section>

        <section className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h2 className="font-semibold mb-3">Message Builder (MVP)</h2>
          <div className="space-y-3">
            <input className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2" placeholder="Customer Name" />
            <input className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2" placeholder="Account Number" />
            <input className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2" placeholder="Reference Number" />
            <textarea className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 min-h-28" placeholder="Generated message preview..." />
            <div className="flex gap-2">
              <button className="px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 font-semibold">Generate</button>
              <button className="px-4 py-2 rounded-lg border border-slate-700">Copy</button>
              <button className="px-4 py-2 rounded-lg border border-slate-700">Telegram Format</button>
            </div>
          </div>
        </section>

        <aside className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h2 className="font-semibold mb-3">World Clock</h2>
          <ul className="space-y-2">
            {zones.map(({ label, zone }) => (
              <li key={zone} className="p-2 rounded border border-slate-800 bg-slate-950">
                <div className="text-sm text-slate-400">{label}</div>
                <div className="font-mono text-lg">
                  {now.toLocaleTimeString("en-US", { timeZone: zone, hour12: false })}
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </main>
    </div>
  );
}