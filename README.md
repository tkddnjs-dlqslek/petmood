# PetMood

> Your pet pops up while you browse. All AI processing runs locally in your browser.

A Chrome extension that overlays your pet (or any photo) on whatever page you're viewing, on a timer you set. Upload a photo, the background is removed locally using on-device AI, and your pet appears with one of 18 animations every 10/30/60 minutes — or any custom interval. A small burst of joy during long focus sessions.

**[Install from the Chrome Web Store →](https://chromewebstore.google.com/detail/petmood-pet-wellness-noti/llalgcfjenkdaecjdapdagjhfedfiamc)**

## Features

- **18 animations** — running, raining, peekaboo, kissing, dominoes, bowling, fireworks, dance party, and more
- **Automatic on a timer** — set every 10/30/60 minutes or a custom interval; your pet pops up without any clicks
- **100% local processing** — photos never leave your device
- **Works with anything** — pets, your face, friends, anything you want to see while you browse
- **No accounts, no telemetry, no IAP**

## How it works

1. Open the extension and add photos of your pet.
2. PetMood removes the background from each photo automatically using an on-device AI model. All processing happens in your browser.
3. While you browse, your pet pops up on a timer you set — running across the screen, blowing kisses, raining down, and more.

## Privacy

- Your photos never leave your device. They are stored in your browser's IndexedDB.
- The content script renders only the user's own pet images as an overlay. It reads no page content and sends nothing to any website.
- The only network request is a one-time download of the open-source background-removal model ([RMBG-1.4](https://huggingface.co/briaai/RMBG-1.4)) from Hugging Face, used purely for local processing.
- No accounts, no analytics, no telemetry.

Full privacy policy: <https://tkddnjs-dlqslek.github.io/petmood/privacy-policy.html>

## Tech stack

- **Framework**: [WXT](https://wxt.dev/) (Manifest V3)
- **UI**: React 19 + TypeScript + Tailwind CSS v4
- **AI**: [@huggingface/transformers](https://www.npmjs.com/package/@huggingface/transformers) running RMBG-1.4 in WebAssembly
- **Storage**: IndexedDB ([idb](https://www.npmjs.com/package/idb)) for photo cutouts, `chrome.storage.local` for settings
- **Scheduling**: `chrome.alarms` (period = the user's chosen timer interval)

## Permissions

PetMood requests three Chrome permissions, all justified:

| Permission | Why |
|---|---|
| `alarms` | Drives the periodic timer that triggers the pet animation. |
| `storage` | Saves your settings (name, pet name, interval, on/off state) locally. |
| `unlimitedStorage` | Removes the default IndexedDB quota so up to 100 pet photos (original + background-removed cutout) can be stored locally. |

It also requests the `<all_urls>` host permission. This is required because the timer fires in the background without a user gesture, so the content script must already be present on the page when the animation needs to play. `activeTab` doesn't work for this use case. The content script only renders an overlay; it never reads page content or sends data anywhere.

## Build

Requires Node.js 18+ and npm.

```bash
git clone https://github.com/tkddnjs-dlqslek/petmood.git
cd petmood
npm install

# Development (auto-reload on save)
npm run dev

# Production build
npm run build

# Production build + zip for Web Store
npm run zip
```

The dev build outputs to `.output/chrome-mv3-dev/` and the production build outputs to `.output/chrome-mv3/`. To load the unpacked extension in Chrome, go to `chrome://extensions/`, enable Developer mode, and click "Load unpacked" → select the output directory.

## Credits

- Background removal model: [BRIA AI RMBG-1.4](https://huggingface.co/briaai/RMBG-1.4)
- Local AI runtime: [transformers.js](https://github.com/huggingface/transformers.js)
- Extension framework: [WXT](https://wxt.dev/)

## License

MIT — see [LICENSE](./LICENSE).
