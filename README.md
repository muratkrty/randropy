# Randropy

A blog made of plain files. No build step, nothing to install: HTML, CSS and one small script. Put the folder on any static web server — or just open it from disk — and it works.

## Writing a post

**With the editor.** Open `write.html` in Chrome or Edge (double-click it, or visit it on your site). The first time you save it asks you to pick the blog folder; after that it works the folder directly. Write — the right pane renders as you type, and the draft saves itself both in the browser and to `posts/` on disk (an unnamed draft lives at `posts/_draft.html`, which is not listed and therefore invisible). Under the text: a word count, a reading time, and a [Gunning Fog](https://en.wikipedia.org/wiki/Gunning_fog_index) gauge — green at 10 or below, blue to 16, red above. `Ctrl/Cmd+B` bolds, `+I` italicizes, `+K` makes a link. Then:

- **Publish** — one click: writes the post file and adds its line to `site.js`. Publishing an already-listed post refreshes its title and stamps `updated:`.
- **Open** — load a published post back into the editor to revise it.
- **Obsidian** — import a markdown note as a draft. Frontmatter is stripped (its `title:` and `date:` are used when present), a leading `# heading` becomes the title, and `[[wikilinks]]` flatten to their text. Images embedded in the note are not copied — drag them from the vault into the editor afterwards.
- **Save** (or Ctrl/Cmd+S) — write the post file without listing it yet.
- Paste or drop an image into the text — it lands in `assets/` and the markdown appears at the cursor. The **Assets** button uploads files explicitly.
- **Room** — fullscreen, with nothing on screen but the title and the text. Esc leaves. **Focus** lights only the paragraph you are in and dims the rest; it is remembered across visits, and the two work well together.
- **Hide preview** — a single centered writing column when you do not need the rendered page.
- **Download** — the fallback for browsers without file access (Safari, Firefox, iPad): hands you the post file and a fresh `site.js` to drop into place.

**By hand.** Copy `posts/_template.html`, name it after your post, and write between the two `script` tags. Then add one line to `POSTS` in `site.js`:

```js
{ date: "2026-09-05", file: "my-post", title: "My post" },
```

Optional fields: `summary` (one line for search and link previews), `image` (a file in `assets/`, shown under the title and in link previews), `updated`.

Order in the list does not matter; posts sort by date, newest first. A post dated in the future stays hidden until that day. A post file that is not in `site.js` is a draft: you can open it by its address, but it is not listed.

## What is where

```
index.html            home page: the lede, and a list that fills itself
posts/                one file per post, containing only the text
posts/_template.html  copy this to start a post by hand
assets/               images
site.js               your settings and the list of posts
write.html            the editor
styles.css            the look
blog.js               the engine (renders markdown, builds pages and metadata)
404.html              shown for missing addresses
```

Site-wide text lives in `site.js` (name, description, footer, analytics token). The lede on the home page is in `index.html`.

## Markdown

```
# Section               becomes an h2 (the post title is the h1)
## Subsection           h3

*italic*  **bold**  `code`  ~~struck~~
[text](https://…)       link
![caption](assets/x.jpg)  a picture on its own line becomes a figure with a caption
> quoted text           blockquote
- item / 1. item        lists; indent two spaces to nest
---                     a rule
text[^1] … [^1]: note   footnotes, numbered in order of appearance
```

Two trailing spaces, or a backslash, at the end of a line make a line break. Raw HTML passes through, so anything markdown cannot do, HTML still can. Fenced code blocks (three backticks) are escaped.

## Previewing

Open `index.html` from your disk. Everything works without a server.

## Hosting

Copy the folder to any web server that serves static files. There is nothing to configure.
