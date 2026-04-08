# `src/app`

This folder is the framework entry layer for the app.

- Route files like `page.js`, `layout.js`, and `api/**/route.js` should stay thin.
- Each page should load data, enforce access, and hand control to a feature component.
- Shared route-facing helpers live in `src/app/lib`.
- Feature UI lives in `src/app/components`.

Start here when you need to trace a URL to the code that renders it.
