// Word-level diff (US-061). Pure ESM shared by the Respond step (base text vs
// suggested text) and the US-060 polish confirm (user text vs polished text).
//
// Classic LCS over whitespace-separated words; adjacent words with the same
// change type merge into one segment so the UI renders few spans. Inputs are
// suggestion/bullet sized (a few hundred words), so the O(m*n) table is cheap.

function tokens(value) {
  return String(value ?? "")
    .split(/\s+/)
    .filter(Boolean);
}

/* Diff two texts into ordered segments:
   [{ type: "same" | "removed" | "added", text }] */
export function wordDiff(before, after) {
  const a = tokens(before);
  const b = tokens(after);
  const m = a.length;
  const n = b.length;

  const lcs = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const segments = [];
  const push = (type, word) => {
    const last = segments[segments.length - 1];
    if (last && last.type === type) {
      last.text += ` ${word}`;
    } else {
      segments.push({ type, text: word });
    }
  };

  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      push("same", a[i]);
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push("removed", a[i]);
      i += 1;
    } else {
      push("added", b[j]);
      j += 1;
    }
  }
  while (i < m) {
    push("removed", a[i]);
    i += 1;
  }
  while (j < n) {
    push("added", b[j]);
    j += 1;
  }

  return segments;
}

/* True when the two texts differ at the word level (whitespace ignored). */
export function hasWordDiff(segments) {
  return segments.some((segment) => segment.type !== "same");
}
