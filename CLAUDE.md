# CLAUDE.md

This file guides Claude Code when working in this repo. Project rules live in `AGENTS.md`; an exhaustive map of what to edit for every UI change lives in `PROJECT_MAP.md`. Read both before making changes.

## Project overview

Personal static site built with **Hugo** (v0.163.2+) and the **Blowfish** theme (vendored under `themes/blowfish`), deployed to Cloudflare Pages at `https://lyrumu.top`.

- Default site language is `en`, but individual articles may be written in Chinese.
- `/Vault` is a **read-only** Obsidian vault mirror (source of truth for notes). Never modify it.
- Many Blowfish templates are overridden in `layouts/`; styles are split into numbered `assets/css/_*.css` files.

## Commands

```bash
# Local development (only when a running server is needed; stop it after use)
# `hugo server` alone is equivalent: `theme` already lives at the root of hugo.toml, and
# --themesDir/--config/--bind all equal Hugo's defaults.
hugo server --port 8080

# Production build (outputs to public/)
hugo --minify --themesDir themes --theme blowfish --config hugo.toml

# New notes article (uses archetypes/notes.md)
hugo new content/notes/<slug>/index.md

# New work detail (uses the independent archetypes/work.md; starts as a draft)
hugo new content --kind work works/<slug>/index.md
```

Hugo is the build tool; there is no package-manager build step. JavaScript regressions run with `node --test tests/*.test.cjs`; validate a generated production site with `python3 -B tests/seo_check.py <output-directory>`.

## Architecture in one screen

- **Work details** — Native Hugo leaf bundles under `content/works/<slug>/`, using `archetypes/work.md` (`type: work`, `layout: page`), mapped by `data/projects.yaml` `page`. README snapshots keep pinned `readmeSource` URLs and original badges; update manually. The distinct type keeps work details out of the home article feed.
- **Content** — Markdown in `content/` (sections `about`, `notes`, `works`, `life`, each with an `_index.md`). Notes articles use the `notes` archetype and inherit cascade defaults (taxonomies, edit, pagination, views, likes) from `content/notes/_index.md`.
- **Data** — `data/*.yaml` consumed by custom shortcodes/partials (`cover.yaml`, `life.yaml`, `notes.yaml`, `projects.yaml`, `resources.yaml`, `music.yaml`, `about_timeline.yaml`, `site.yaml`).
- **Layout overrides** — `layouts/_default/{baseof,list,single}.html`, `layouts/page.html`, and `layouts/partials/{home/custom,head,vendor}.html` are project-level overrides of the theme; don't change them without understanding the design contract.
- **Shortcodes** — project-specific ones in `layouts/shortcodes/` (e.g. `life-grid`, `projects-list`, `resources-list`, `music-list`, `about-timeline`, `about-contact`, `page-hero`, `icon`, `site-stats`, `section-rule`, `file-tree`).
- **Icons** — Simple Icons SVGs in `assets/icons/`, rendered via `{{< icon "name" >}}`.
- **Static assets** — `static/fonts/` (self-hosted fonts), `static/image/`, `static/notes-assets/`, and `static/life/music/preview/`.

## CSS loading (critical gotcha)

Do **not** use `@import` inside a custom stylesheet — the theme's `resources.Get "css/custom.css"` appends raw bytes without resolving imports, causing 404s. The override at `layouts/partials/head.html` discovers `css/_*.css` and builds a shared bundle plus page-specific cover and music bundles.

- Put new CSS in `assets/css/_NN_module.css` where `NN` is the next number (current sequence: `_01_tokens.css`–`_17_article-copy.css`); files are picked up automatically. `_08`/`_16` load only on home; `_10` loads only on pages using `music-list`; the other modules are shared.
- `assets/css/custom.css` is an index/backup only, no longer loaded by the build.
- Never edit `themes/blowfish/`.

## Design system

Tokens live in `assets/css/_01_tokens.css` and drive everything: home cover, cards, Blowfish utilities.

- Light: bg `#FAF9F5`, text `#1F1E1D`, accent `#D97757`. Dark: bg `#141413`, text `#FAF9F5`, accent `#E08769`.
- Fonts: `Fraunces` (display serif), `Newsreader` (body serif), `Inter` (sans), self-hosted in `static/fonts/`.
- Decorative dividers: `✦` and `──`.

## Navigation

Menu items live in `hugo.toml` under `[[menu.main]]`: `ABOUT ME`, `DOCS`, and `WORKS` are top-level; the profile, friends, and `DAILY` entries are children of `ABOUT ME`. Current section landing pages render through `layouts/_default/list.html`, including those declaring `layout: "page"`; ordinary articles and work details use `layouts/page.html`. Follow `AGENTS.md` before changing navigation or sections.

## Firebase, comments, and references

- Firebase credentials are exposed in `hugo.toml` under `[params.firebase]`; the real security boundary is Firestore Rules + Anonymous Auth (see `FIREBASE_SECURITY.md`). The overridden `vendor.html` loads Firebase only on home, the notes section and its articles, and term pages; templates control which counters are displayed.
- Giscus comments load via `layouts/partials/extend-footer.html`; theme switching handled by `assets/js/giscus-loader.js`.

## When asked to change content

First decide: a data-driven UI update (usually `data/*.yaml` + shortcode) or a page content update (`content/**/*.md`). Then consult `PROJECT_MAP.md` to confirm the exact file. Follow the conventions in `AGENTS.md`. Update `DONE.md` only for website architecture, deployment, frontend, backend, or service integration changes, newest first. A normal entry should use 2–4 bullets for the outcome and reason, key files/modules, and validation or known limits; a major architecture entry may use up to 6. Keep enough context to locate and maintain the implementation, without operational chronology. Do not log article creation/migration, text or formatting edits, individual illustrations or their data mappings, or rule/Skill documentation maintenance. `DONE_ARCHIVE.md` is the read-only full-history backup and must not receive new entries.
