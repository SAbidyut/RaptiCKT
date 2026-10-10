# RaptiCKT for rapti.net (website package)

This folder is the complete RaptiCKT circuit simulator as a website: the same interface and
every feature of the Android app (520 components, live simulation, oscilloscope, multimeter,
analyses, examples, manual, saved projects), running in any modern browser on desktop,
tablet and phone. It needs no server code, no database and no internet libraries.

- `raptickt/` — the folder to upload
- `raptickt-website.zip` — the same folder, zipped

## What is inside `raptickt/`

| File | What it is |
| --- | --- |
| `index.html` | the page that starts the simulator |
| `css/styles.css` | all styles (minified) |
| `js/app.js` | the whole app and simulation engine (minified) |
| `js/boot.js` | turns on the offline cache |
| `sw.js` | offline cache (service worker): repeat visits open instantly and it works offline |
| `manifest.webmanifest` | lets visitors "Install" / "Add to Home screen" |
| `assets/` | logo and app icons |
| `embed-example.html` | a sample page showing the simulator inside a section of a page |

All links inside are relative, so the folder works under any address.

## Putting it on rapti.net

**Option 1: its own page (recommended).** Unzip `raptickt-website.zip` and upload the
`raptickt` folder to your site, e.g. into `public_html/simulator/` with cPanel File Manager
or FTP. It then opens at `https://rapti.net/simulator/`. Link to it from a menu or button.

**Option 2: inside a section of an existing page.** Upload the folder as in Option 1, then
paste this where the section should be (WordPress: a *Custom HTML* block; Elementor: an
*HTML* widget):

```html
<section id="simulator" style="max-width:1280px;margin:0 auto;padding:0 16px 32px">
  <h2>RaptiCKT Circuit Simulator</h2>
  <div style="position:relative;width:100%;height:min(86vh,860px);min-height:560px;border-radius:16px;overflow:hidden;background:#0b1120">
    <iframe src="/simulator/" title="RaptiCKT circuit simulator" loading="lazy"
      allow="fullscreen; clipboard-write; web-share" allowfullscreen
      style="position:absolute;inset:0;width:100%;height:100%;border:0"></iframe>
  </div>
</section>
```

Change `/simulator/` to wherever you uploaded the folder. `embed-example.html` shows the same
section on a full page, with a phone layout.

## Notes

- Use **https** (rapti.net already does): the offline cache and "Install app" need it.
- Visitors' circuits are saved in their own browser on their own device. **Library → Export /
  Backup** downloads them as files, and a `.rckt` / `.json` file can be dragged onto the page
  to open it.
- In a browser, **Esc** or the phone's **Back** gesture steps back inside the app, like the
  Android Back button. **Full** uses the browser's full-screen mode (`allowfullscreen` on the
  iframe is needed for that).
- Desktop: mouse wheel zooms, Space runs/pauses, `R` rotates, `W` wire mode, `Delete` deletes,
  Ctrl+Z / Ctrl+Y undo / redo, Ctrl+D duplicates.

## Building a new version

The package is generated from the app source in `web/`. After changing the app:

```sh
cd web
npm ci
npm run website
```

This rewrites `website/raptickt/` and `website/raptickt-website.zip`. Upload the new folder
over the old one; visitors get the update on their next visit.

---

### বাংলায় সংক্ষেপে (Banglish)

`raptickt-website.zip` unzip kore `raptickt` folder ta rapti.net er `public_html/simulator/`
e upload korun, tahole `https://rapti.net/simulator/` e full app cholbe. Kono page er section
e bosate chaile upore deya `<section> … <iframe>` code ta oi page er Custom HTML block e paste
korun.
