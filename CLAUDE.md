# chromelock

manifest v3 chrome extension that blocks distracting sites. vanilla js, no build step, no dependencies, no tests.

## layout

- `manifest.json`: extension config (permissions: storage, declarativeNetRequest, tabs, alarms)
- `background.js`: service worker. builds declarativeNetRequest dynamic rules from storage and handles temporary unblocks via chrome.alarms
- `logger.js`: loaded into the service worker with `importScripts`
- `popup.html` / `popup.js` / `popup.css`: toolbar popup to add/remove sites and toggle blocking
- `blocked.html`: redirect target for blocked sites, with a form to request a temporary unblock
- `create_icons.py`: regenerates the placeholder icons in `icons/` (`uv run create_icons.py`)

## state and messaging

all state lives in `chrome.storage.sync`:

- `blockedSites`: string[] of bare domains (no protocol, no `www.`)
- `isEnabled`: boolean, treated as enabled unless strictly `false`
- `temporaryUnblocks`: map of domain to `{ expiresAt, reason, ... }`

the `storage.onChanged` listener in `background.js` rebuilds all rules from storage. the popup and blocked page write to storage and also send runtime messages (`updateRules`, `temporaryUnblock`).

## mv3 constraints

- extension pages cannot run inline scripts or inline event handlers (`onclick=...`). the mv3 csp blocks them. put js in a separate file loaded with `<script src>`
- the service worker can be killed at any time. do not rely on in-memory state surviving between events

## verifying changes

the extension cannot be loaded in a cloud session, so check what you can:

- `node --check background.js popup.js logger.js`
- `python3 -m json.tool manifest.json > /dev/null`
- review any html-embedded js by hand

say in the pr which behavior still needs a manual check. the user tests locally by loading the folder unpacked at `chrome://extensions` and clicking reload.

## conventions

- lowercase for all comments
- no emojis and no em dashes in new code, comments, or commit messages
- keep code simple and readable, avoid over-engineering
- don't add features, refactors, or docs that weren't asked for (suggest them instead)
- if js tooling is ever added, use pnpm. for python, use uv
- commits: conventional prefix (feat, fix, docs, refactor, chore, test, style), all lowercase, one-liner, no signature or co-authored-by lines
