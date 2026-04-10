# Spoti-Ignore

A Chrome/Chromium browser extension that lets you instantly tell Spotify to stop recommending a song — using Spotify's own built-in "Ignore in recommendations" API.

No third-party servers. No account required beyond your normal Spotify login. Just a button.

<!-- Screenshots — drop images into the screenshots/ folder and uncomment these lines:
![Button in Spotify Web Player](screenshots/button.png)
![Already-ignored state](screenshots/ignored-state.png)
-->

![Example of the button](screenshots/spotify-with-the-button.png)

![Example of the button in "already ignored" state](screenshots/spotify-ignored-state.png)

---

## Features

- **One-click ignore** — A floating button on the Spotify Web Player lets you ignore any playing track.
- **Keyboard shortcut** — Press **Shift + X** to ignore the current track without touching the mouse.
- **Live status detection** — The button shows a loading state while tokens are being captured and turns green once everything is ready.
- **Duplicate-ignore protection** — If a track is already in your ignore list the button updates automatically to reflect that.
- **Guided onboarding** — On first use a modal walks you through finding your user ID; if you navigate to your profile page the ID is captured automatically from the URL.
- **Change user ID** — If you have multiple Spotify accounts or need to update your user ID for any reason, you can change it from the extension popup by clicking "Change user ID" or clear it entirely with the "Clear" button.

---

## Installation

The extension is not published to the Chrome Web Store; you load it directly from this repository.

### 1. Download the extension

Clone or download this repo:

```bash
git clone https://github.com/z-designs/spoti-ignore.git
```

Or download the ZIP from GitHub and extract it.

### 2. Open the Chrome extensions page

Navigate to `chrome://extensions` in your browser (works in Chrome, Brave, Edge, and other Chromium-based browsers).

### 3. Enable Developer Mode

Toggle **Developer mode** on — the switch is in the top-right corner of the extensions page.

### 4. Load the extension

Click **Load unpacked** and select the **`extension/`** folder inside this repository.

The Spoti-Ignore icon will appear in your browser toolbar.

### 5. Open Spotify Web Player

Go to [open.spotify.com](https://open.spotify.com) and start playing a song. A green **Ignore** button will appear in the bottom-right corner of the page after a few seconds once the extension has captured the required tokens.

### 6. Set up your Spotify user ID (first time only)

A setup modal will appear automatically when the extension loads for the first time. You have two options:

**Option A — automatic (recommended):** Click **"Open my Spotify profile page"** in the modal. Once the page loads the extension detects your user ID from the URL and fills it in for you.

**Option B — manual:** Your user ID appears in the URL when you visit your profile (`open.spotify.com/user/YOUR_ID`). Paste it into the input field and click **Save & continue**.

Your ID is stored in `localStorage` in your browser and never asked for again.

### Changing your user ID later

Click the extension icon in the toolbar and then click on either "clear" or "change user ID" to reset it. You can then repeat the setup process to enter a new ID.

---

## How it works

The extension injects a content script into `open.spotify.com` that:

1. Intercepts outgoing `fetch` and `XHR` requests to capture the Bearer and Client tokens Spotify already uses internally.
2. Detects the currently playing track URI from the DOM.
3. When you click **Ignore**, it calls `spclient.wg.spotify.com/collection/v2/write` with your user ID and the track URI — the same endpoint Spotify's own right-click menu uses.

Your credentials never leave Spotify's own infrastructure.

---

## Debug logging

By default all console output is suppressed. If you need to troubleshoot the extension, open `extension/content.js` and change the first flag:

```js
const DEBUG = false; // change to true
```

Then reload the extension in `chrome://extensions` and refresh the Spotify tab. Detailed logs will appear in the browser DevTools console under the `[spoti-ignore]` prefix.

---

## Roadmap

- [ ] **Auto-skip** — Automatically skip to the next track when an ignored song starts playing.
- [ ] **Ignore stats** — Show a counter of how many songs you have ignored in the current session and all-time.
- [ ] **Unignore** — If you ignored a song by mistake, add a way to reverse it without leaving the web player.
- [ ] **Option to blacklist artists** — Add an option to ignore all songs from a specific artist, not just individual tracks, with a local blacklist stored in `localStorage`.
- [x] **Detection of invalid user ID** — If the stored user ID becomes invalid (e.g. due to a Spotify account change), detect this and prompt the user to update it.
- [ ] **Support for other browsers** — Test and ensure compatibility with Firefox and Safari, which may require some adjustments to the extension APIs used.
- [ ] **Option for blacklisting genres**
- [ ] **Shorcut for starting radio on track**
- [ ] **Option for removing song from playlist like on mobile and app**

---

## Disclaimer

This project was built with assistance from AI (GitHub Copilot / Claude). The code has been reviewed and tested by the author, but use it at your own discretion. Spoti-Ignore is an independent hobby project and is not affiliated with, endorsed, or connected to Spotify AB in any way.

---

## License

[MIT](LICENSE)

