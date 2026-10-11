import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const releaseRoot = resolve(root, "release", "chrome-web-store");
const viteCli = join(root, "node_modules", "vite", "bin", "vite.js");
const apiUrl = "https://response-escalation-assistant.vercel.app";
const profiles = [
  { slug: "winbucks", label: "WinBucks" },
];

if (!existsSync(viteCli)) throw new Error("Vite is missing. Install the project dependencies first.");
mkdirSync(releaseRoot, { recursive: true });

// The earlier preparation produced a Default package, but that organization
// is no longer in scope for publication.
for (const oldOutput of [
  resolve(releaseRoot, "default"),
  resolve(releaseRoot, "rea-default.zip"),
]) {
  if (oldOutput.startsWith(`${releaseRoot}${sep}`)) {
    rmSync(oldOutput, { recursive: true, force: true });
  }
}

for (const profile of profiles) {
  const env = {
    ...process.env,
    VITE_API_URL: apiUrl,
    VITE_REA_COMPANY_SLUG: profile.slug,
  };
  execFileSync(process.execPath, [viteCli, "build"], { cwd: root, env, stdio: "inherit" });

  const packageDir = resolve(releaseRoot, profile.slug);
  const normalizedPackageDir = `${packageDir}${sep}`;
  if (!normalizedPackageDir.startsWith(`${releaseRoot}${sep}`)) {
    throw new Error(`Refusing to write outside extension release folder: ${packageDir}`);
  }
  rmSync(packageDir, { recursive: true, force: true });
  cpSync(join(root, "dist"), packageDir, { recursive: true });

  const manifestPath = join(packageDir, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.name = `REA for ${profile.label}`;
  manifest.description = `Response and Escalation Assistant for ${profile.label}.`;
  manifest.homepage_url = `${apiUrl}/${profile.slug}`;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const zipPath = resolve(releaseRoot, `rea-${profile.slug}.zip`);
  const python = process.platform === "win32" ? "python" : "python3";
  execFileSync(python, [join(root, "scripts", "zip-extension.py"), packageDir, zipPath], {
    cwd: root,
    stdio: "inherit",
  });
  console.log(`Created ${zipPath}`);
}
