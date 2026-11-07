# Contributing

Thanks for helping improve Minesweeper! Bug reports, ideas and pull requests are all welcome.

## Reporting a bug

Open an issue and include:

- What you did, what you expected, and what happened instead
- Your browser and device (for example "Safari on iPhone 15")
- The difficulty level, if it matters

## Making a change

1. Fork the repository and create a branch from `main`.
2. Make your change. There is no build step: edit the files and refresh the page.
3. Run the tests with `npm test` (or `node --test`) and add tests for any new game rule.
4. Open a pull request describing what changed and why. A screenshot helps for visual changes.

## Guidelines

- **Keep `engine.js` free of the DOM.** All game rules live there so they can be tested in Node. Anything that touches the page belongs in `app.js`.
- **No dependencies or build tools.** The project should keep working by just opening `index.html`.
- **Keep it accessible.** Cells are real buttons with labels, focus rings and keyboard support. Please do not regress that.
- **Match the existing style:** 2-space indentation, single quotes, semicolons (see `.editorconfig`).
- If you change files that ship with the app, bump `CACHE` in `sw.js`.
