# 🪨 RockStack Two

> Part of the RockStack system built for jeni.rocks.
> GitHub MCP connected to Claude for full codebase context.

---

## The Stack

| | |
|---|---|
| **Owner** | Jen Casano |
| **Domain** | jeni.rocks |
| **Repo** | github.com/jencasano/showup |
| **Live URL** | showup.jeni.rocks |

---

## Project

**showup.** — A workout accountability tracker. Track your activities, follow friends, show up every day.

- **Frontend:** Vanilla HTML, CSS, JavaScript
- **Database:** Firebase Firestore
- **Auth:** Firebase Authentication (Google)
- **Hosting:** Firebase Hosting
- **DNS:** AWS Route 53

---

## Workflow

```
Edit locally in VS Code (D:\dev\showup)
        ↓
Test on Live Server (127.0.0.1:5500)
        ↓
git add . && git commit -m "message"
        ↓
git push (→ github.com/jencasano/showup)
        ↓
firebase deploy (→ showup.jeni.rocks)
```

---

## How RockStack Two Differs from RockStack One

| | RockStack One (Neithan) | RockStack Two (Jen) |
|---|---|---|
| Server | AWS Lightsail | Firebase Hosting |
| Edit via | VS Code Remote SSH | VS Code local |
| Deploy | git push to server | firebase deploy |
| MCP | GitHub connected | GitHub connected |

---

## File Structure

```
showup/
├── index.html              ← main app
├── setup.html              ← first-time onboarding
├── 404.html
├── css/
│   ├── variables.css       ← design tokens (colors, fonts, spacing)
│   ├── base.css            ← reset, typography
│   ├── layout.css          ← header, tabs, month bar
│   ├── login.css           ← login screen
│   ├── tracker.css         ← tracker grid
│   ├── modals.css          ← month setup modal
│   ├── setup.css           ← setup page
│   └── ui.css              ← toasts, loaders
├── js/
│   ├── firebase-config.js  ← Firebase init
│   ├── auth.js             ← Google auth
│   ├── app.js              ← main orchestrator
│   ├── tracker.js          ← tracker grid logic
│   ├── month-setup.js      ← monthly setup modal
│   ├── ui.js               ← toasts, loaders
│   └── utils.js            ← helper functions
├── assets/
├── firebase.json
├── firestore.rules
└── firestore.indexes.json
```

---

*Built by Jen & Claude — 2026* 🪨
