# Security

GeoDex is static files. There is no server, no account and no database outside the browser. Progress lives in the browser's IndexedDB and leaves it only as a backup file the learner downloads. The design is described in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Reporting a vulnerability

Please report a vulnerability privately through GitHub. Open the **Security** tab of this repository and choose **Report a vulnerability**. Do not open a public issue for it.

Helpful things to include are what you found, how to reproduce it, and the browser you used. I will reply as soon as I can.

## In scope

- A way to run script in the app, for example through a crafted backup file, a URL or content text
- A backup file that, when restored, removes or rewrites progress instead of only adding to it
- A request the app makes to any host other than its own and Wikimedia Commons
- A secret that ends up in the repository or in the built site

## Out of scope

- Anyone with access to the browser profile reading or changing its own progress
- Losing progress by clearing the browser's data, which Settings and Help explain
- Landmark photos or their credits as served by Wikimedia Commons
