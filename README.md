# kwantklubben-site

The public site for **Kwant Klubben**, an independent student club at the University of Southern Denmark. Plain HTML/CSS/vanilla-JS — no framework, no toolchain, nothing to install. GitHub Pages assembles the pages with Jekyll (layouts and front matter only, no plugins), so pushing to `main` is the build. Live at `kwantklubben.com`.

This repo is intentionally separate from the club's private research repo (`kwantklubben`, not public) and from the public project mirror (`kwantklubben-projects`). Nothing sensitive lives here — brand assets, marketing copy, and a link out to the application form.

## Structure

```
_layouts/default.html the <head>, nav, footer and scripts every page shares.
                      ONE copy — GitHub Pages assembles the pages with Jekyll.
_config.yml           build config: what stays out of the published site.

index.html            landing — volatility surface, the loop, research teaser, join
about/index.html      what the klub is, the process in full, AI, joining
research/index.html   the library, how publishing works, what counts
partners/index.html   collaboration, talks, mentorship, co-designed events
sponsors/index.html   redirect stub -> /partners/  (the old URL is on LinkedIn)

css/styles.css        the original brand stylesheet (tokens + component idiom),
                      a short relaunch section, then the page-furniture classes
js/kk-nav.js          the mobile drawer. Drives the `hidden` ATTRIBUTE, not a class.
assets/               logos, favicon set
tools/check-site.py   the drift + invariant check. Read the next section.
tools/serve-preview.py local preview with the Jekyll layout applied, for when
                      you have no Ruby. Read the next section.

EDITING.md            how to change the site from github.com. Start there.
```

**Local preview.** Opening the files directly no longer works: pages are Jekyll
fragments, so a plain static server shows the raw `---` header and no nav. Run
`python tools/serve-preview.py`, install Jekyll, or push to a branch — CI builds
the site with the same action Pages uses and fails the PR if anything is wrong.

**Editing the copy?** See [EDITING.md](EDITING.md). The pages carry no inline
styles — 173 were lifted into named classes so a page reads as its words plus a
class name, and `check-site.py` fails if one is added back.

Nav is **About · Research · Partners**, plus a Contact button (a `mailto:`, not a page — there was nothing a contact page would hold that the mailto does not) and the Join button pointing straight at the application form.

## The style

The chunky idiom **is** the brand: 2px ink borders, hard `4px 4px 0` pop shadows, lime section fills, badges, gridpaper. `css/styles.css` is the original stylesheet, unchanged, with a clearly-marked section appended at the bottom for the few things the relaunch actually needed — the hero chart, a three-column variant of the divided grid, the footer's second link group, a skip link, and one brand fix (the token layer's `--focus-ring` was `--blue-500`; the brand has no blue in it).

If you are adding to this site, use the existing components. Do not introduce a second visual system.

## The check

There is no build step and no templating, so `HEAD-COMMON`, `NAV`, `FOOTER` and `SCRIPTS` are **literally duplicated** in all four pages. Every path inside them is root-relative precisely so they can be byte-identical.

**To change the nav, footer, head or scripts: edit `index.html`, paste into the other three, then run the check.**

```
python tools/check-site.py     # -> "ok: 4 blocks identical, invariants and CSS cascade rules hold across 4 pages"
```

It also runs in CI on every push and pull request (`.github/workflows/check.yml`).

It is not a build step — it produces nothing and the site works without it. It exists because the July 2026 relaunch grew the site from three pages to five, hand-edited the old script's hardcoded three-file list, and shipped three pages whose font URL had lost `&family=Chewy`. So beyond comparing the blocks, it asserts things a diff cannot see, on every page it finds by glob:

| Invariant | Why it is checked |
|---|---|
| `&family=Chewy` in the font URL | The footer wordmark is Chewy at 37vw with a `-3.3vw` nudge tuned to its metrics. Without the font it falls back to system cursive and clips out of its own box. |
| `.kk-footer-word` present | Same wordmark, absent entirely. |
| No class on the `<footer>` element | `footer{display:block}` (0,0,1) is what undoes the wordmark overlay on phones. Any class selector out-specifies it. |
| `#kk-nav-panel` ships with `hidden` | Checked at attribute position, not as a substring — `class="… hidden"` would satisfy a substring test while being exactly the class-for-attribute swap this catches. `kk-nav.js` is deferred and owns that attribute; without it the drawer renders **open** on a cold mobile cache. |
| An application link exists and matches | Any `forms.gle` **or** `docs.google.com/forms` link, over http or https, must equal the one true form URL — and at least one must be present. It is on every poster. |
| No `TODO(content)` / `REPLACE_ME` | Placeholders must not reach production. |
| Every root-relative nav `href` resolves | A nav pointing at a directory that does not exist. |
| The CSS cascade rules | No bare `.kk-footer` class selector; the mobile `footer{display:block}` override still present; no `display` declared inside `.js .kk-nav__panel`. |

Pages opt out by containing a `REDIRECT` marker in a comment near the top **and** actually being a redirect — that is how `sponsors/index.html` is excluded. Skipped pages are printed, so an opt-out is visible in the CI log.

### Two rules the CSS depends on

Both of these broke in July 2026 and both are cheap to break again:

- **No class on the `<footer>` element.** The mobile override that undoes the wordmark overlay is `footer{display:block}`. Any class selector out-specifies it and strands the letters behind the footer text on phones.
- **The nav drawer is driven by the `hidden` attribute**, never by an `.is-open` class. `css/styles.css` has a long comment explaining why declaring `display` in the mobile `.kk-nav__panel` block makes `hidden` inert. Read it before touching that block.

## Local preview

**Always serve it. Never open `index.html` with `file://`.**

```
python tools/serve-preview.py     # -> http://localhost:4000
```

Paths are root-relative, so under `file://` they resolve against your filesystem root — the page renders as unstyled HTML with broken images. That is the expected result of double-clicking the file, not a broken site.

`python -m http.server` fixes the paths but not the pages: every page here is a
Jekyll *fragment*, so a plain static server serves the raw `---` front matter as
visible text with no `<head>`, no nav and no footer. `serve-preview.py` applies
`_layouts/default.html` the way Pages does and sends no-cache headers, so a reload
always shows the file on disk.

It implements exactly the four substitutions this site uses — `page.title`,
`page.description`, `page.url`, `site.url`, plus `{{ content }}` — and nothing
else. It is a **preview, not a build**: it writes no files, and CI still builds
with the real `jekyll-build-pages` action. If a future page needs a Liquid tag
beyond those four, this renders it literally and the CI job's "unrendered Liquid"
assertion is what catches it. Installing Ruby and running `jekyll serve` remains
the higher-fidelity option.

## Deploy

Push to `main`. GitHub Pages deploys from `main` / root. The custom domain is set in repo Settings → Pages, which manages the `CNAME` file automatically.
