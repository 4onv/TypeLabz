# TypeLabz

[Open the typing console](https://keytempo-typing-lab.xuechuifengxiaoxiami.chatgpt.site/)

TypeLabz measures the gaps between keystrokes. Use the keyboard map to compare left-to-left and right-to-right movements on US QWERTY, or inspect the letters in a particular word. A practice session targets a slow pair or a missed letter and retests it in fresh words.

Choose a time, word or character target. Switch between everyday words, hard words, code terms and random letters, and optionally add punctuation or capitals. Space submits the current word, so an extra or missing letter stays with that word.

## Save progress

Sign in with ChatGPT on the live site to save completed test and training summaries to your account. Progress includes recent sessions, personal-best test WPM, accuracy and active typing time. Guest tests run directly in the browser.

Use **Save offline replay** on the results screen to download a self-contained HTML player. It shows the passage, keystroke timing, errors and corrections. Open it in a browser to step through a run without an internet connection. The account database stores session summaries. Full replay events stay in the browser or the file you save.

## Run locally

Use Node.js 24 or newer. From the repository root:

```sh
node scripts/build-worker.mjs
node scripts/preview.mjs
```

Open the loopback address the server prints. Rebuild and restart after editing the client or Worker. To try the progress flow locally, start the preview with `node scripts/preview.mjs --demo-account`, then use its sign-in link. This mode uses a local demonstration identity and an in-memory SQLite database that resets on server restart.

## Project layout

- `dist/` contains the editable browser app, generators, replay player, styles and Keytrace logo.
- `worker/handler.mjs` handles account and progress requests. The deployed app relies on Sites to authenticate visitors and supply trusted identity headers.
- `drizzle/` contains database migrations. The Worker uses the D1 binding named `DB`.
- `scripts/build-worker.mjs` bundles the client and handler into `dist/server/index.js` for deployment.

If you self-host, use an authenticating gateway that strips incoming identity headers and sets its own verified user ID before forwarding requests to the Worker. The local demo account is part of the loopback preview only.
