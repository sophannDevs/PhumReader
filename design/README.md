# PhumiReader (ភូមិReader) V2 – design pack

Everything Claude Code needs to build the V2 frontend.

| Path | What it is |
|---|---|
| `spec.md` | Every page, route, control, state and flow. Read the section for your task. |
| `foundations.md` | Colours, type, spacing, components, patterns, Khmer type rules |
| `screens/` | 113 PNGs: `NN-page[-state]-desktop.png` (1440 px) and `-phone.png` (390 px) |
| `demo-data.json` | The only source of demo content (series, episodes, comments, notifications, creator works, admin queues, help, policies…) |
| `i18n/km-dictionary.json` | 611 English → Khmer UI strings (draft; native review needed) |
| `assets/covers`, `assets/panels` | Cover and comic panel artwork (SVG). Copy to `public/covers`, `public/panels`. Paths in demo-data are `/covers/<id>.svg`. |
| `prototype-src/` | The clickable prototype's source, one folder per page: `body.html` (markup), `page.css` (exact styles), `page.js` (exact behaviour). Shared: `shared.css`, `shared.js`, `header.html`, `footer.html`, `layers.html`. **Reference only** — read it to match spacing and behaviour, then rebuild in React. |

Screen numbers match the spec sections (01 Home … 26 Become a creator; 00 Foundations).
Live prototype: the "V2 – PhumiReader" page of the Claude Design canvas.
