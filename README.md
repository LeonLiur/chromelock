# ChromeLock 🔒

A Chrome extension to block unproductive websites and help you stay focused.

## Features

- ✅ Block distracting websites like YouTube, LinkedIn, Facebook, etc.
- ✅ Easy-to-use popup interface for managing blocked sites
- ✅ Add/remove blocked sites on the fly
- ✅ Beautiful modern UI with smooth animations
- ✅ Works with all Chromium-based browsers (Chrome, Dia, Edge, Brave, etc.)
- ✅ Custom blocked page with motivational message

## Installation

### For Dia Browser (or any Chromium-based browser)

1. Open your browser and navigate to the extensions page:
   - For Dia/Chrome: `dia://extensions` or `chrome://extensions`
   - Or go to Settings → Extensions

2. Enable **Developer Mode** (toggle in the top right corner)

3. Click **Load unpacked**

4. Navigate to the `chromelock` folder and select it

5. The extension is now installed! You should see the ChromeLock icon in your toolbar

## Usage

### Managing Blocked Sites

1. Click the ChromeLock icon in your browser toolbar

2. To **add a site**:
   - Type the website domain (e.g., `youtube.com`, `linkedin.com`)
   - Click "Add Site" or press Enter
   - The site will be immediately blocked

3. To **remove a site**:
   - Click the × button next to the site name in the list

### Default Blocked Sites

The extension comes pre-configured with these commonly distracting sites:
- youtube.com
- linkedin.com
- facebook.com
- twitter.com
- reddit.com
- instagram.com

You can remove any of these or add your own!

## How It Works

- Uses Chrome's `declarativeNetRequest` API for efficient blocking
- Redirects blocked sites to a custom blocked page
- All settings are synced across your browser using `chrome.storage.sync`
- Lightweight and fast - runs as a service worker

## Customization

You can easily customize the extension:

- **Add more default sites**: Edit the `DEFAULT_BLOCKED_SITES` array in `background.js`
- **Change the blocked page**: Edit `blocked.html` to customize the message and styling
- **Modify the UI**: Edit `popup.css` to change colors and styles

## Icons

The extension uses placeholder icon references. To add custom icons:

1. Create PNG images in the `icons/` folder:
   - `icon16.png` (16×16 pixels)
   - `icon48.png` (48×48 pixels)
   - `icon128.png` (128×128 pixels)

2. Use a lock icon or any design that represents blocking/focus

## Files Structure

```
chromelock/
├── manifest.json       # Extension configuration
├── background.js       # Service worker (blocking logic)
├── popup.html         # Popup interface
├── popup.css          # Popup styling
├── popup.js           # Popup functionality
├── blocked.html       # Page shown when site is blocked
├── icons/             # Extension icons
└── README.md          # This file
```

## Permissions

The extension requires these permissions:
- `storage` - To save your list of blocked sites
- `declarativeNetRequest` - To block websites
- `tabs` - To manage tab redirects
- `<all_urls>` - To block any website you choose

## Troubleshooting

**Sites aren't being blocked:**
- Make sure you entered the domain correctly (e.g., `youtube.com` not `https://youtube.com`)
- Try removing and re-adding the site
- Reload the extension from the extensions page

**Changes not taking effect:**
- Click the extension icon and verify the site is in your blocked list
- Try reloading the page you're trying to block

## License

Free to use and modify for personal use.

---

Built with ❤️ for productivity and focus.

