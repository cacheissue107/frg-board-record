# Fox River Grove Board Record (Unofficial)

A small static website (live at <https://groundedbuilder.github.io/frg-board-record/>) with a searchable record of Fox River Grove, Illinois Village Board meetings. It's plain HTML, CSS and JavaScript, with no build step and no server code, so it can be hosted for free almost anywhere.

This is an independent project and is **not** an official Village website.

## What's in this folder

| Path | What it is |
| --- | --- |
| `index.html` | The main page (the record, with its four tabs) |
| `about.html` | The About page: what this is, where the data comes from |
| `assets/styles.css` | All the styling, including light and dark mode |
| `assets/app.js` | Everything the main page does: loading data, filters, tabs, links |
| `assets/theme.js` | The light/dark/auto theme button (used by both pages) |
| `assets/favicon.svg` | The little icon in the browser tab |
| `data/meetings.json` | The meeting data. **This file is public once you deploy.** |
| `scripts/update_data.py` | Turns the tracker spreadsheet into `data/meetings.json` |
| `requirements.txt` | The one Python library the script needs |

## 1. Update the data

You do this whenever the tracker spreadsheet changes.

**One-time setup:** install the library that reads Excel files. In Terminal:

```bash
pip3 install --user -r requirements.txt
```

**Every time:** open Terminal in this folder (in Finder, right-click the folder → *New Terminal at Folder*), then run:

```bash
python3 scripts/update_data.py
```

That reads `Village Board Tracker.xlsx` from your iCloud *Village Board* folder and writes `data/meetings.json`. You'll see something like:

```
Exported 75 meetings, 12 storylines to data/meetings.json
Removed 41 street addresses from public comments (use --show-redactions to list them)
```

The footer of the site shows the date of this export ("Data updated …").

Useful options:

- `--tracker "/path/to/Other Tracker.xlsx"` uses a spreadsheet somewhere else.
- `--show-redactions` lists every address it removed. Worth a quick look after big updates.
- `--no-redact-public` keeps addresses. **Only for your own use. Never publish that file.**

### About the address redaction

Public comment summaries often say things like "Eric Zilch (815 Foxanna) asked…". By default the script removes the address and keeps the name: "Eric Zilch asked…". When an address is part of a sentence, it becomes `[address removed]`. Only the public comment text is changed. Agenda items and outcomes keep their addresses, since those are the properties the board is discussing.

The script looks for a house number followed by capitalized street words, so it can occasionally miss an unusual address or catch something that isn't one. Run with `--show-redactions` to check.

## 2. Preview the site on your Mac

Browsers won't let the page load its data file if you just double-click `index.html`. Run a tiny local web server instead:

```bash
python3 -m http.server
```

Then open <http://localhost:8000> in your browser. Press `Ctrl` + `C` in Terminal to stop the server when you're done.

## 3. Deploy to GitHub Pages (free)

GitHub Pages hosts the site straight from a GitHub repository. You set it up once; after that, every update is just "commit and push."

### One-time setup

1. **Make a GitHub account** at <https://github.com/signup> if you don't have one.

2. **Create an empty repository.** Go to <https://github.com/new>.
   - *Repository name:* `frg-board-record` (or anything you like; it becomes part of the address)
   - Choose **Public**. (Free GitHub Pages needs a public repo.)
   - **Leave all the "Initialize this repository with…" boxes unchecked.** This folder already has its own first commit.
   - Click **Create repository**.

3. **Let your Mac log in to GitHub.** The easiest way is GitHub's command-line tool:
   ```bash
   brew install gh
   ```
   ```bash
   gh auth login
   ```
   Choose *GitHub.com* → *HTTPS* → *Login with a web browser* and follow the prompts. (No Homebrew? Install [GitHub Desktop](https://desktop.github.com/) instead and use *File → Add Local Repository* to pick this folder. It handles login and has a Push button.)

4. **Connect this folder to the new repository and upload it.** GitHub shows these commands on the empty repo's page. Replace `YOUR-USERNAME`:
   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/frg-board-record.git
   ```
   ```bash
   git push -u origin main
   ```

5. **Turn on Pages.** On the repository page, go to **Settings** → **Pages** (left sidebar). Under *Build and deployment*:
   - *Source:* **Deploy from a branch**
   - *Branch:* **main** and folder **/ (root)** → **Save**

6. Wait a minute or two, then refresh that Settings → Pages screen. It will show your address, like `https://YOUR-USERNAME.github.io/frg-board-record/`. That's your public site.

### Every update after that

```bash
python3 scripts/update_data.py
```
```bash
git add -A
```
```bash
git commit -m "Update meeting data"
```
```bash
git push
```

GitHub republishes the site automatically, usually within a minute.

## The simpler alternative: Netlify drag-and-drop

If you don't want to use Git or GitHub at all:

1. Run `python3 scripts/update_data.py` so the data is current (with redaction on).
2. Go to <https://app.netlify.com/drop> and sign up (free).
3. Drag this whole `frg-board-record` folder onto the page.

Netlify gives you a public address right away. To update, drag the folder onto your site's *Deploys* page again. The downside is that it's manual every time, and there's no history of changes.

## Sharing a specific view

The address bar always reflects what you're looking at, so you can copy and share any view. Examples:

- `?tab=votes`: the Votes & attendance tab
- `?topic=Block%20B&year=2025`: 2025 meetings about Block B
- `?q=water%20rates&split=1`: split votes mentioning "water rates"
- `?no=Knar`: meetings where Trustee Knar voted no

The browser's Back button steps back through your filter changes.

## Before you go public: a short checklist

- [ ] Run `python3 scripts/update_data.py --show-redactions` and skim the list.
- [ ] Open the site locally and spot-check a few public comments.
- [x] The site address (`https://groundedbuilder.github.io/frg-board-record/`) is set in the `og:url` and `canonical` tags of `index.html` and `about.html`. If you rename the repo or move to your own domain, update those.
- [ ] Decide how people should reach you with corrections (an email address, or "open an issue on GitHub") and add it to the *Corrections* section of `about.html`.

## Privacy and third parties

The site loads fonts from Google Fonts and nothing else: no analytics, ads or trackers. The light/dark theme choice is saved in the visitor's own browser (localStorage) and never sent anywhere.
