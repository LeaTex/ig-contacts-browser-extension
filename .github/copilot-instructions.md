# IG Followers Project Guidelines

## Architecture
- This project is a Manifest V3 browser extension focused on Instagram contact analysis.
- Keep component boundaries clear:
	- `background.js`: data loading from Instagram endpoints, cookie access, pagination, and loader status persistence.
	- `content.js`: in-page right panel UI, filters, rendering, and cache usage.
	- `popup.js` + `popup.html`: user entry point that toggles or injects the in-page panel.
	- `content.css` and `styles.css`: separate styles for in-page panel vs popup UI.

## Build And Test
- There is no active root build pipeline (`package.json` is not present at root).
- Primary validation flow is manual extension testing:
	1. Open `chrome://extensions/`
	2. Enable Developer mode
	3. Load unpacked from this workspace folder
	4. Open an Instagram tab and test popup open, panel toggle, and contact loading
- When changing message flow, verify both directions:
	- popup -> content (`toggleInPagePanel`)
	- content -> background (`loadContacts`, `getLoaderStatus`)

## Conventions
- Preserve existing naming style and prefixes:
	- UI classes/IDs use `igc-` prefix in panel code and styles.
	- Storage keys are string constants near the top of each file.
- Keep Chrome messaging defensive:
	- Always handle `chrome.runtime.lastError` in callbacks.
	- Return `true` from message listeners when responding asynchronously.
- Keep Instagram fetch behavior consistent:
	- Use credentials-included requests and required headers (`x-csrftoken`, `x-ig-app-id`, `x-requested-with`).
	- Preserve throttling (`delay()` between paginated requests) to reduce rate-limit risk.

## Pitfalls
- The extension depends on Instagram session cookies (`csrftoken`, `ds_user_id`); logged-out sessions will fail.
- Instagram private API responses can change unexpectedly; avoid brittle assumptions.
- Avoid adding UI elements that overlap Instagram controls; panel layering already uses high z-index values.
- Do not introduce extra permissions in `manifest.json` unless the feature requires them.
