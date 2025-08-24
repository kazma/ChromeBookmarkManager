# Bookmarkz

Bookmarkz is a Chrome extension for cleaning up bookmarks.
It can scan for duplicate or dead bookmarks, plan cleanup actions, and apply them safely.
Options let you strip tracking parameters, control fragment handling, and tune which copies to keep.

## Build

1. Install dependencies
   ```bash
   npm install
   ```
2. Build the extension
   ```bash
   npm run build
   ```
3. Load the `dist` folder as an unpacked extension in Chrome.

## Features

- Detects duplicate bookmarks and dead links.
- Normalizes URLs by removing tracking parameters and optionally fragments.
- Generates an actionable plan to remove duplicates.
- Apply changes in dry-run or real modes, with rollback support.
- Configurable keeper rules (folder priority, shallow/older preference).

## License

[MIT](LICENSE)
