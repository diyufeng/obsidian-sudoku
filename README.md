# Sudoku

Render Sudoku puzzles directly inside Obsidian notes. Write a board as a fenced `sudoku` code block — the plugin renders a styled 9×9 grid with thick palace borders, optional row/column labels, and per-cell typography for givens, answers, wrong attempts, and pencil candidates.

## Features

- **Code-block renderer** — identical mechanism to Obsidian's built-in `mermaid` processor. Just use ` ```sudoku ` fences.
- **Board metadata** — title, difficulty, note, size, and background toggle via `#key: value` lines at the top of the block.
- **Three board sizes** — `small` (26px cells), `medium` (38px, default), `large` (52px), each with proportional fonts and border weights.
- **Cell typing** — givens (black), correct answers (blue), wrong attempts (red), empty cells (no number).
- **Highlight cells** — mark important cells with an orange background.
- **Pencil candidates** — render `{123}` as a 3×3 mini-grid with each digit in its natural position (1 top-left, 9 bottom-right).
- **Even-palace background** — optional alternating palace shading for easier scanning.
- **Row/column labels** — 1–9 headers on the top and left, with empty padding on the other sides.
- **Light & dark theme** — border and background colors adapt automatically.
- **Insert template command** — one command in the palette drops a ready-to-edit sudoku block.

## Installation

### From Obsidian Community Plugins

1. Open **Settings → Community plugins**.
2. Click **Browse** and search for "Sudoku".
3. Install, then enable the plugin.

### Manual (BRAT / beta testing)

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin.
2. Add this repository's URL in BRAT.
3. BRAT will install and keep the plugin updated.

### From source

```bash
npm install
npm run build
```

Copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/obsidian-sudoku/`, then enable the plugin in **Settings → Community plugins**.

## Usage

Insert a code block with the `sudoku` language tag. The command palette item **"插入数独代码块模板" / "Insert sudoku code block template"** drops a complete example.

### Metadata (optional, top of the block)

| Key             | Description                                             | Default   | Shown above board |
|-----------------|---------------------------------------------------------|-----------|-------------------|
| `#title`        | Board title                                             | —         | Yes               |
| `#difficulty`   | Difficulty label (rendered as `难度: <value>`)          | —         | Yes               |
| `#note`         | Free-form note (line breaks preserved)                  | —         | Yes               |
| `#size`         | `small` / `medium` / `large`                            | `medium`  | No                |
| `#show-background` | `true` / `false` — shade even palaces                | `false`   | No                |

Empty values are ignored. Unknown keys are ignored.

### Cell tokens

Each cell is one whitespace-separated token. Prefixes can be combined in any order.

| Token     | Meaning                                                      |
|-----------|--------------------------------------------------------------|
| `5`       | Given clue (black)                                           |
| `*5`      | Correct answer (blue)                                        |
| `!5`      | Wrong attempt (red)                                          |
| `$5`      | Highlighted cell (orange background)                         |
| `$*5`     | Highlighted correct answer                                   |
| `.`       | Empty cell                                                   |
| `{123}`   | Empty cell with candidates 1, 2, 3 (rendered as a 3×3 grid) |
| `${123}`  | Highlighted empty cell with candidates                       |

#### Combination rules

1. **`*` and `!` together** → the cell is treated as `wrong` (`!` wins), regardless of prefix order. `*!5` and `!*5` both render as a red 5.
2. **Digit and `{candidates}` together** → if the token contains `*` or `!`, the digit is ignored and candidates are shown. Otherwise, candidates are ignored and the digit is shown.

   | Token       | Renders as                                  |
   |-------------|---------------------------------------------|
   | `5{123}`    | Given 5 (candidates dropped)                |
   | `*5{123}`   | Candidates 1, 2, 3 (digit dropped)         |
   | `!5{123}`   | Candidates 1, 2, 3 (digit dropped)         |
   | `*!5{123}`  | Candidates 1, 2, 3 (digit dropped)         |

3. **Candidates** — digits inside `{}` are deduplicated and sorted. `{99112}` is equivalent to `{129}`.
4. **Unrecognized tokens** are treated as empty cells.

### Separator lines

Lines starting with `-` (e.g. `------+-------+------`) are ignored, so you can keep the traditional Sudoku board layout for readability.

## Example

````
```sudoku
#title: Example Puzzle
#difficulty: Easy
#size: medium
#show-background: true
#note: * = answer, ! = wrong, $ = highlight, {} = candidates

5 3 .  | . 7 .  | . . .
6 . .  | *1 9 5 | . . .
. 9 8  | . . .  | . 6 .
------+-------+------
8 . .  | . 6 .  | . . !3
4 . .  | 8 . 3  | . . 1
7 . .  | . 2 .  | . . 6
------+-------+------
. 6 .  | . . .  | $2 8 .
. . .  | 4 1 9  | . . 5
. . .  | . 8 .  | . 7 9
```
````

## Development

```bash
npm run dev     # esbuild watch mode
npm run build   # type-check + production build
```

Project layout:

- `src/main.ts` — parser, metadata extraction, and HTML renderer
- `styles.css` — all styling, driven by CSS variables under `.sudoku-wrapper`
- `esbuild.config.mjs` — bundler config
- `tsconfig.json` — TypeScript config

### Styling extension

All sizing is driven by CSS variables declared on `.sudoku-wrapper`. To add a new size variant, declare a class like `.sudoku-wrapper.size-xlarge` and override `--cell`, `--label-size`, `--num-size`, `--cand-size`, `--thick`. See the in-repo skill `.trae/skills/obsidian-plugin-css-wrapper/SKILL.md` for the wrapper-isolation pattern used here.

## Compatibility

- Obsidian **1.4.0** or later.
- Works in both light and dark themes.
- Desktop and mobile (no node-only APIs).

## License

MIT
