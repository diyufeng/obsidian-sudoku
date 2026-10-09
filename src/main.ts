import { Plugin } from 'obsidian';

type CellType = 'question' | 'answer' | 'wrong' | 'empty';

interface CellMeta {
  type: CellType;
  value: string;          // '1'-'9'，empty 时为 ''
  candidates: number[];   // 备选数 1-9，去重
  highlight: boolean;     // 重点单元格
}

interface SudokuMeta {
  title?: string;
  difficulty?: string;
  note?: string;
  size: string;
  showBackground: boolean;
}

interface ParsedSudoku {
  meta: SudokuMeta;
  board: CellMeta[][];
}

const SIZES = ['small', 'medium', 'large'];

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c] as string));
}

export default class SudokuRendererPlugin extends Plugin {
  async onload() {
    // 注册 sudoku 代码块处理器，和mermaid机制完全一致
    this.registerMarkdownCodeBlockProcessor("sudoku", (src, el) => {
      const parsed = this.parseSudoku(src);
      const html = this.renderBoard(parsed);
      // 用 DOMParser 解析再 appendChild，避免直接 innerHTML 赋值（Obsidian 审核要求）
      const body = new DOMParser().parseFromString(html, 'text/html').body;
      el.empty();
      while (body.firstChild) {
        el.appendChild(body.firstChild);
      }
    });

    // 命令：一键插入sudoku模板（command id 不含插件 id 'sudoku'，避免审核警告）
    this.addCommand({
      id: "insert-template",
      name: "插入数独代码块模板",
      editorCallback: (editor) => {
        const template = "```sudoku\n#title: 示例数独\n#difficulty: 简单\n#size: medium\n#show-background: false\n#note: * 表示答案，! 表示错误，$ 表示重点，{} 表示备选数\n\n5 3 . | . 7 . | . . .\n6 . . | 1 9 5 | . . .\n. 9 8 | . . . | . 6 .\n------+-------+------\n8 . . | . 6 . | . . 3\n4 . . | 8 . 3 | . . 1\n7 . . | . 2 . | . . 6\n------+-------+------\n. 6 . | . . . | 2 8 .\n. . . | 4 1 9 | . . 5\n. . . | . 8 . | . 7 9\n```";
        editor.replaceSelection(template);
      }
    })
  }

  // 解析sudoku文本：#key: value 元数据 + 棋盘行（忽略分隔横线）
  parseSudoku(text: string): ParsedSudoku {
    const meta: SudokuMeta = { size: 'medium', showBackground: false };
    const boardLines: string[] = [];
    const lines = text.split('\n')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('-'));
    for (const line of lines) {
      const m = line.match(/^#([a-zA-Z][\w-]*)\s*:\s*(.*)$/);
      if (m) {
        const key = m[1].toLowerCase();
        const value = m[2].trim();
        if (value === '') continue;  // 空值忽略
        if (key === 'title') meta.title = value;
        else if (key === 'difficulty') meta.difficulty = value;
        else if (key === 'note') meta.note = value;
        else if (key === 'size') {
          const v = value.toLowerCase();
          meta.size = SIZES.includes(v) ? v : 'medium';
        } else if (key === 'show-background') {
          meta.showBackground = value.toLowerCase() === 'true';
        }
        // 未知 key 忽略
      } else {
        boardLines.push(line);
      }
    }
    const board: CellMeta[][] = boardLines.map(line =>
      line.replace(/\|/g, ' ').split(/\s+/).filter(t => t).map(t => this.parseCell(t))
    );
    return { meta, board };
  }

  // 解析单元格 token：前缀 $*! 任意组合 + 数字 + {备选数}（数字与备选数可同时出现）
  parseCell(token: string): CellMeta {
    let hasAnswer = false;
    let hasWrong = false;
    let highlight = false;
    let rest = token;

    // 消费前缀 $ * !（可任意顺序组合）
    while (rest.length > 0 && '$*!'.includes(rest[0])) {
      const ch = rest[0];
      if (ch === '$') highlight = true;
      else if (ch === '*') hasAnswer = true;
      else if (ch === '!') hasWrong = true;
      rest = rest.slice(1);
    }

    // 先抽取 {备选数}，再从剩余部分找数字，避免误把花括号内的数字当成填写数
    const braceMatch = rest.match(/\{([^}]*)\}/);
    const body = braceMatch ? rest.replace(braceMatch[0], '') : rest;
    const digitMatch = body.match(/[1-9]/);
    const candidates: number[] = [];
    if (braceMatch) {
      const set = new Set<number>();
      for (const d of braceMatch[1]) {
        const n = parseInt(d, 10);
        if (n >= 1 && n <= 9) set.add(n);
      }
      candidates.push(...Array.from(set).sort((a, b) => a - b));
    }
    const digit = digitMatch ? digitMatch[0] : '';

    // ! 与 * 同时存在时，! 优先，类型为 wrong
    const type: CellType = hasWrong ? 'wrong' : hasAnswer ? 'answer' : 'question';

    // 数字与备选数同时存在：存在 * 或 ! 时忽略数字（显示备选数），否则忽略备选数（显示数字）
    if (digit && braceMatch) {
      if (hasAnswer || hasWrong) {
        return { type: 'empty', value: '', candidates, highlight };
      }
      return { type, value: digit, candidates: [], highlight };
    }

    // 仅备选数
    if (braceMatch) {
      return { type: 'empty', value: '', candidates, highlight };
    }

    // 仅数字
    if (digit) {
      return { type, value: digit, candidates: [], highlight };
    }

    // 空（. 或无法识别的 token）
    return { type: 'empty', value: '', candidates: [], highlight };
  }

  // 渲染HTML棋盘
  renderBoard(parsed: ParsedSudoku): string {
    const { meta, board } = parsed;
    const wrapperCls = `sudoku-wrapper size-${meta.size}` + (meta.showBackground ? " show-background" : "");
    let html = `<div class="${wrapperCls}">`;

    // 元数据栏：title/difficulty/note 任一存在时渲染
    if (meta.title || meta.difficulty || meta.note) {
      html += `<div class="sudoku-meta">`;
      if (meta.title) html += `<div class="meta-title">${escapeHtml(meta.title)}</div>`;
      if (meta.difficulty) html += `<div class="meta-difficulty">难度: ${escapeHtml(meta.difficulty)}</div>`;
      if (meta.note) html += `<div class="meta-note">说明：${escapeHtml(meta.note)}</div>`;
      html += `</div>`;
    }

    html += `<table class="sudoku-table">`;

    // 上序号行：左角空 + 1-9 + 右角空
    html += `<tr>`;
    html += `<td class="plain-cell"></td>`;
    for (let c = 0; c < 9; c++) {
      html += `<td class="plain-cell label">${c + 1}</td>`;
    }
    html += `<td class="plain-cell"></td>`;
    html += `</tr>`;

    // 9 数据行
    for (let r = 0; r < 9; r++) {
      html += `<tr>`;
      html += `<td class="plain-cell label">${r + 1}</td>`;
      for (let c = 0; c < 9; c++) {
        let cls = "sudoku-cell";
        if (r === 0) cls += " row-0";
        if (r === 8) cls += " row-8";
        if (c === 0) cls += " col-0";
        if (c === 8) cls += " col-8";
        if (c === 2 || c === 5) cls += " thick-right";
        if (r === 2 || r === 5) cls += " thick-bottom";
        const palace = Math.floor(r / 3) * 3 + Math.floor(c / 3) + 1;
        if (palace % 2 === 0) cls += " palace-even";
        const cell = board[r]?.[c];
        if (cell) {
          cls += ` cell-${cell.type}`;
          if (cell.highlight) cls += " cell-highlight";
        }
        const inner = this.renderCellInner(cell);
        html += `<td class="${cls}" data-r="${r}" data-c="${c}">${inner}</td>`;
      }
      html += `<td class="plain-cell"></td>`;
      html += `</tr>`;
    }

    // 下空行
    html += `<tr>`;
    for (let c = 0; c < 11; c++) {
      html += `<td class="plain-cell"></td>`;
    }
    html += `</tr>`;

    html += `</table></div>`;
    return html;
  }

  // 渲染单元格内部：备选数 3x3 网格，或单数字，或空
  renderCellInner(cell?: CellMeta): string {
    if (!cell) return '';
    if (cell.type === 'empty') {
      if (cell.candidates.length === 0) return '';
      // 3x3 grid，按 1..9 顺序填入，存在则显示
      let h = `<div class="candidates">`;
      for (let n = 1; n <= 9; n++) {
        const has = cell.candidates.includes(n);
        h += `<span class="cand">${has ? n : ''}</span>`;
      }
      h += `</div>`;
      return h;
    }
    return escapeHtml(cell.value);
  }

  onunload() {}
}
