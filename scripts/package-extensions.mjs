import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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

  // Tesseract.js defaults to CDN-hosted OCR assets. Package the worker,
  // compatible LSTM cores, and English data so extension OCR stays local.
  const ocrDir = join(packageDir, "ocr");
  const coreDir = join(ocrDir, "core");
  const languageDir = join(ocrDir, "lang");
  const licenseDir = join(ocrDir, "licenses");
  mkdirSync(coreDir, { recursive: true });
  mkdirSync(languageDir, { recursive: true });
  mkdirSync(licenseDir, { recursive: true });
  copyFileSync(
    join(root, "node_modules", "tesseract.js", "dist", "worker.min.js"),
    join(ocrDir, "worker.min.js"),
  );

  const corePackage = join(root, "node_modules", "tesseract.js-core");
  for (const file of [
    "tesseract-core-lstm.wasm.js",
    "tesseract-core-lstm.wasm",
    "tesseract-core-simd-lstm.wasm.js",
    "tesseract-core-simd-lstm.wasm",
    "tesseract-core-relaxedsimd-lstm.wasm.js",
    "tesseract-core-relaxedsimd-lstm.wasm",
  ]) {
    copyFileSync(join(corePackage, file), join(coreDir, file));
  }

  copyFileSync(
    join(root, "node_modules", "@tesseract.js-data", "eng", "4.0.0_best_int", "eng.traineddata.gz"),
    join(languageDir, "eng.traineddata.gz"),
  );
  copyFileSync(
    join(root, "node_modules", "tesseract.js", "LICENSE.md"),
    join(licenseDir, "tesseract.js-LICENSE.md"),
  );
  copyFileSync(
    join(root, "node_modules", "tesseract.js-core", "LICENSE"),
    join(licenseDir, "tesseract.js-core-LICENSE"),
  );
  writeFileSync(
    join(licenseDir, "THIRD-PARTY-NOTICES.txt"),
    "English trained data: @tesseract.js-data/eng 1.0.0, distributed under the MIT license. Source: https://github.com/naptha/tessdata\n",
  );

  const workerScriptPath = join(ocrDir, "worker.min.js");
  let workerScript = readFileSync(workerScriptPath, "utf8");
  const localTessdataFallback = 'new URL("./lang",self.location.href).href';
  const localCoreFallback = 'new URL("./core/",self.location.href).href';
  const dataFallback = '"https://cdn.jsdelivr.net/npm/@tesseract.js-data/".concat(i,m?"/4.0.0_best_int":"/4.0.0")';
  const coreFallback = '"https://cdn.jsdelivr.net/npm/tesseract.js-core@v".concat(h.substring(1))';
  if (!workerScript.includes(dataFallback) || !workerScript.includes(coreFallback)) {
    throw new Error("Could not replace Tesseract CDN fallbacks; refusing to package remote OCR URLs.");
  }
  workerScript = workerScript
    .replace(dataFallback, localTessdataFallback)
    .replace(coreFallback, localCoreFallback);
  writeFileSync(workerScriptPath, workerScript);

  // Tesseract.js includes a default worker CDN URL even though the extension
  // supplies workerPath explicitly. Point that dormant default locally too.
  const appAssets = join(packageDir, "assets");
  let replacedWorkerDefault = 0;
  let replacedLocalhostWorkerDefault = 0;
  for (const file of readdirSync(appAssets).filter((name) => name.endsWith(".js"))) {
    const path = join(appAssets, file);
    const source = readFileSync(path, "utf8");
    let localSource = source.replace(
      /`https:\/\/cdn\.jsdelivr\.net\/npm\/tesseract\.js@v\$\{[^}]+\}\/dist\/worker\.min\.js`/g,
      '"./ocr/worker.min.js"',
    );
    const localhostWorkerURL = '"http://localhost:3000/dist/tesseract.min.js"';
    if (localSource.includes(localhostWorkerURL)) {
      localSource = localSource.replace(localhostWorkerURL, '"./ocr/worker.min.js"');
      replacedLocalhostWorkerDefault += 1;
    }
    if (localSource !== source) {
      replacedWorkerDefault += 1;
      writeFileSync(path, localSource);
    }
  }
  if (replacedWorkerDefault !== 1) {
    throw new Error(`Expected one Tesseract worker CDN default in the extension bundle; found ${replacedWorkerDefault}.`);
  }
  if (replacedLocalhostWorkerDefault > 1) {
    throw new Error(`Expected at most one dormant Tesseract localhost worker URL; found ${replacedLocalhostWorkerDefault}.`);
  }

  // jsPDF ships an optional `pdfobjectnewwindow` output mode that injects
  // PDFObject from cdnjs. REA only exports PDFs with `doc.save()`, so remove
  // this unused mode from the packaged bundle instead of leaving a dormant
  // remote-code loader in the Manifest V3 extension.
  let removedPdfObjectLoaders = 0;
  for (const file of readdirSync(appAssets).filter((name) => name.endsWith(".js"))) {
    const path = join(appAssets, file);
    const source = readFileSync(path, "utf8");
    const startMarker = "case`pdfobjectnewwindow`:";
    const endMarker = "case`pdfjsnewwindow`:";
    const start = source.indexOf(startMarker);
    if (start === -1) continue;
    const end = source.indexOf(endMarker, start + startMarker.length);
    if (end === -1 || source.indexOf(startMarker, start + startMarker.length) !== -1) {
      throw new Error(`Could not safely isolate jsPDF's PDFObject output mode in ${file}.`);
    }
    const branch = source.slice(start, end);
    if (!branch.includes("https://cdnjs.cloudflare.com/ajax/libs/pdfobject/2.1.1/pdfobject.min.js")) {
      throw new Error(`Expected the jsPDF PDFObject CDN loader in ${file}; refusing an unverified patch.`);
    }
    const localOnlyBranch = `${startMarker}throw Error("PDFObject output mode is unavailable in this extension.");`;
    writeFileSync(path, `${source.slice(0, start)}${localOnlyBranch}${source.slice(end)}`);
    removedPdfObjectLoaders += 1;
  }
  if (removedPdfObjectLoaders !== 1) {
    throw new Error(`Expected to remove one jsPDF PDFObject CDN loader; found ${removedPdfObjectLoaders}.`);
  }

  const manifestPath = join(packageDir, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.name = `REA for ${profile.label}`;
  manifest.description = `Response and Escalation Assistant for ${profile.label}.`;
  manifest.homepage_url = `${apiUrl}/${profile.slug}`;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  // Guard against remote script and worker URLs in the actual packaged files.
  // Network API endpoints and documentation links are allowed; executable
  // code must be shipped with this extension.
  for (const directory of [appAssets, ocrDir]) {
    const pending = [directory];
    while (pending.length) {
      const current = pending.pop();
      for (const file of readdirSync(current, { withFileTypes: true })) {
        const path = join(current, file.name);
        if (file.isDirectory()) {
          pending.push(path);
          continue;
        }
        if (!file.isFile() || !/\.(?:js|mjs|cjs)$/.test(file.name)) continue;
        const source = readFileSync(path, "utf8");
        const remoteCodeUrls = source.match(/https?:\/\/[^"'`\s)]*\.(?:m?js|wasm)(?:[?#][^"'`\s)]*)?/gi) ?? [];
        const executableRemoteCodeUrls = remoteCodeUrls.filter((url) =>
          !url.startsWith("http://localhost:") && !url.startsWith("https://github.com/naptha/tesseract.js"),
        );
        if (executableRemoteCodeUrls.length) {
          throw new Error(`Remote executable-code URL found in packaged file ${file.name}: ${executableRemoteCodeUrls[0]}`);
        }
      }
    }
  }

  const zipPath = resolve(releaseRoot, `rea-${profile.slug}.zip`);
  const python = process.platform === "win32" ? "python" : "python3";
  execFileSync(python, [join(root, "scripts", "zip-extension.py"), packageDir, zipPath], {
    cwd: root,
    stdio: "inherit",
  });
  console.log(`Created ${zipPath}`);
}
