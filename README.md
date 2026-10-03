# apomonosi.github.io

Landing page and project showcase for **apomonosi**: open tools and research
for safe, responsible AI-driven development. *Apomonosi* (ἀπομόνωση) is Greek for
*isolation*.

Live at <https://apomonosi.github.io/>. Project documentation sites live under
their own paths (for example `/sandboxing/`, `/ai-microservices/`, `/agentic/`).

## Adding a project

All project data lives in [`data/projects.json`](data/projects.json). The
project cards, the category filters, the ⌘K command palette and the `projects` /
`open` commands in the terminal all read from it. To add a project, append one
object to the `projects` array:

```json
{
  "id": "my-project",
  "name": "My Project",
  "repo": "apomonosi/my-project",
  "tagline": "One sentence on what it is.",
  "description": "Two or three sentences on the intention behind it.",
  "status": "active",
  "category": "tooling",
  "icon": "sandbox",
  "tags": ["isolation", "python"],
  "highlights": ["First key point", "Second key point", "Third key point"],
  "snippet": "pip install my-project",
  "docs": "https://apomonosi.github.io/my-project/",
  "source": "https://github.com/apomonosi/my-project"
}
```

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Unique slug. Used in URLs (`#project-<id>`) and in the terminal (`open <id>`). |
| `name` | yes | Display name. |
| `tagline` | yes | One sentence, shown prominently on the card. |
| `description` | yes | The intention behind the project, in two or three sentences. |
| `docs` | yes | Link to the documentation. This is the card's main button. |
| `source` | | Link to the source repository. |
| `repo` | | `owner/name`, shown under the title. |
| `status` | | `active`, `published`, `beta`, `alpha`, `research`, `planned` or `archived`. Sets the badge colour. |
| `category` | | Groups projects into the filter chips, for example `tooling` or `research`. |
| `icon` | | `sandbox`, `actions`, `shield`, `book`, `flask` or `network`. Without one, the card shows the name's initials. |
| `tags` | | Shown on the card. Clicking a tag filters by it. |
| `highlights` | | Up to about three short bullet points. |
| `snippet` | | One shell command, shown with a copy button. |
| `accent` | | A CSS colour that overrides the card's accent (default cyan). |

Projects appear in the order they are listed.

## Structure

```
index.html            page markup
data/projects.json    showcase data (the only file to edit when adding a project)
assets/css/site.css   design tokens and all styles
assets/js/main.js     boot: project cards, filters, stats, palette items
assets/js/hero.js     WebGL containment field (shader + particle simulation)
assets/js/terminal.js simulated agentctl shell
assets/js/palette.js  ⌘K command palette with fuzzy search
assets/img/mark.svg   logo / favicon
.nojekyll             serve files as-is on GitHub Pages
```

There is no build step and there are no dependencies. GitHub Pages serves the
repository root directly.

## Local preview

The page loads `data/projects.json` with `fetch`, so it has to be served over
HTTP rather than opened as a file:

```console
$ python3 -m http.server 8000
$ open http://localhost:8000/
```

## Accessibility and motion

The hero animation and the terminal replay respect `prefers-reduced-motion`.
Motion can also be paused from the footer or the command palette. The animation
stops while the hero is off-screen or the tab is hidden. Without WebGL, the page
falls back to a static gradient.
