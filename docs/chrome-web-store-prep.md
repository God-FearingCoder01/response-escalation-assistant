# Chrome Web Store release preparation

## Release model

REA is maintained once and packaged into one fixed-organization extension for the current release:

- **REA for WinBucks** sends requests only for the `winbucks` organization.

The organization slug is baked into the package at build time. The extension fetches that single organization and sends `X-Company-Slug` on tenant API requests; it does not provide an organization picker. The website uses its organization URL as the tenant context and has no workspace-switch control. There is no Default listing in this release. Do not change the extension's slug after publishing: the listing is dedicated to its organization.

The website remains available on the existing organization URLs. The extension builds do not add an organization switch to the website. The `/monitor` system-administrator portal remains a privileged tenant administration surface.

## Build

From the repository root, run:

```sh
npm run package:extensions
```

This builds both profiles against `https://response-escalation-assistant.vercel.app` and creates:

- `release/chrome-web-store/rea-winbucks.zip`

Each ZIP has `manifest.json` at its root. The corresponding unpacked folders are beside the ZIPs for local loading in `chrome://extensions` with Developer mode enabled. Increase the manifest version before every store update.

## Store review checklist

Before uploading each ZIP:

1. Load that unpacked package in Chrome and confirm the toolbar opens the side panel and all organization data/actions stay in its assigned organization.
2. Prepare a separate listing for each package: name, short and detailed descriptions, 128×128 icon, screenshots, support contact, and organization-specific branding.
3. Complete the privacy and data-use disclosures, provide a publicly accessible privacy policy URL, and verify that it accurately describes REA's data collection, processing, retention, and deletion practices.
4. Supply reviewer instructions and a working test account for that organization. Do not put credentials or private customer data in this repository or listing assets.
5. Upload each ZIP in the Chrome Web Store developer dashboard and review the permissions and listing previews before submitting.

The manifest requests `sidePanel` and `storage`, and injects the floating REA launcher on web pages using `<all_urls>`. This broad host access is needed to preserve the launcher wherever agents work, and will be visible in Chrome's permission disclosure. The floating button's dismissal preference is stored locally by the extension. The side panel's API traffic goes to the production REA host.

## Remaining publication inputs

The ZIPs are build artifacts, not store submissions. The publisher must provide and verify the store listing assets, privacy policy, support contact, test credentials/instructions, and data-safety answers in the developer dashboard. The privacy details must be confirmed against the live service before submission.
