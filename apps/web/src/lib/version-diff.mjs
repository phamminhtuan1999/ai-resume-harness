// Document-level diff for the Tailored CV "Version Diff" panel.
//
// Two unified (single-column) views over the SAME pair of texts:
//   - Words: an inline token stream with added/removed words highlighted, line
//     breaks preserved (the on-screen default).
//   - Lines: whole lines tagged added/removed/context, Git-unified style.
//
// Both share one classic LCS. Texts are a whole CV (a few hundred lines), so the
// O(m*n) table is cheap. The bullet-level word diff lives in `word-diff.mjs`;
// this module is doc-aware (keeps newlines) and powers char-level stats.

// Words split on whitespace; newlines kept as their own "\n" token so the words
// view can reflow into the source's line structure.
function wordTokens(text) {
  const tokens = [];
  const lines = String(text ?? "").split("\n");
  lines.forEach((line, index) => {
    for (const word of line.split(/\s+/)) {
      if (word) tokens.push(word);
    }
    if (index < lines.length - 1) tokens.push("\n");
  });
  return tokens;
}

// Classic LCS over an array of string tokens -> ordered ops. Equal tokens are
// "same"; a divergence emits "removed" (from `a`) then "added" (from `b`).
function lcsOps(a, b) {
  const m = a.length;
  const n = b.length;
  const lcs = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      lcs[i][j] =
        a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const ops = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      ops.push({ type: "same", value: a[i] });
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ type: "removed", value: a[i] });
      i += 1;
    } else {
      ops.push({ type: "added", value: b[j] });
      j += 1;
    }
  }
  while (i < m) {
    ops.push({ type: "removed", value: a[i] });
    i += 1;
  }
  while (j < n) {
    ops.push({ type: "added", value: b[j] });
    j += 1;
  }
  return ops;
}

/* Words view: array of lines, each line an array of merged segments
   [{ type: "same" | "removed" | "added", text }]. Newline tokens break lines so
   the view keeps the document's shape with inline word highlights. */
export function diffWordsByLine(before, after) {
  const ops = lcsOps(wordTokens(before), wordTokens(after));
  const lines = [];
  let current = [];
  for (const op of ops) {
    if (op.value === "\n") {
      lines.push(current);
      current = [];
      continue;
    }
    const last = current[current.length - 1];
    if (last && last.type === op.type) {
      last.text += ` ${op.value}`;
    } else {
      current.push({ type: op.type, text: op.value });
    }
  }
  lines.push(current);
  return lines;
}

/* Lines view: ordered rows [{ type: "same" | "removed" | "added", text }] over
   whole lines. */
export function diffByLine(before, after) {
  const ops = lcsOps(String(before ?? "").split("\n"), String(after ?? "").split("\n"));
  return ops.map((op) => ({ type: op.type, text: op.value }));
}

/* Character deltas for the summary header: characters of added vs removed words
   (newline tokens excluded). `net = added - removed`. */
export function diffCharStats(before, after) {
  const ops = lcsOps(wordTokens(before), wordTokens(after));
  let added = 0;
  let removed = 0;
  for (const op of ops) {
    if (op.value === "\n") continue;
    if (op.type === "added") added += op.value.length;
    else if (op.type === "removed") removed += op.value.length;
  }
  return { added, removed, net: added - removed };
}

/* True when the two texts differ at all (word level). */
export function hasVersionDiff(before, after) {
  const { added, removed } = diffCharStats(before, after);
  return added > 0 || removed > 0;
}
