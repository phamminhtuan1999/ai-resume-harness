#!/usr/bin/env bash
#
# sync-backlog.sh — keep the "Sliced Stories" status column in
# docs/stories/backlog.md in sync with the durable Harness matrix.
#
# The durable matrix (`harness-cli query matrix`) is the source of truth for
# story status. The backlog markdown table is a convenience snapshot and tends
# to drift. This script treats the table as DERIVED from the matrix.
#
#   scripts/sync-backlog.sh            # check (default): report drift, exit 1 if any
#   scripts/sync-backlog.sh --check    # same as default
#   scripts/sync-backlog.sh --write    # rewrite each row's status from the matrix
#
# --write only updates the leading status keyword of an existing row's Status
# cell and preserves any trailing annotation, e.g. "implemented (E2E pending)".
# Rows present in the matrix but missing from the table are reported by --check,
# not auto-added.
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLI="$ROOT/scripts/bin/harness-cli"
BACKLOG="$ROOT/docs/stories/backlog.md"
MODE="${1:---check}"

STATUS_RE='planned|in_progress|implemented|changed|retired'

[ -x "$CLI" ] || { echo "error: harness-cli not found at $CLI" >&2; exit 2; }
[ -f "$BACKLOG" ] || { echo "error: backlog not found at $BACKLOG" >&2; exit 2; }

# "US-NNN <status>" pairs from the durable matrix (status = the keyword that sits
# immediately before the four proof-boolean columns, so titles can't false-match).
matrix_pairs() {
  "$CLI" query matrix --numeric 2>/dev/null \
    | sed -nE "s/^(US-[0-9]+).*[[:space:]](${STATUS_RE})[[:space:]]+[01][[:space:]]+[01][[:space:]]+[01][[:space:]]+[01].*/\1 \2/p" \
    | sort
}

# "US-NNN <status>" pairs from the backlog Sliced Stories table (leading keyword
# of the 4th column; trailing annotations are ignored for comparison).
backlog_pairs() {
  grep -E '^\| US-[0-9]+ \|' "$BACKLOG" \
    | sed -nE "s/^\| (US-[0-9]+) \| [^|]*\| [^|]*\| (${STATUS_RE}).*/\1 \2/p" \
    | sort
}

case "$MODE" in
  --check|"")
    drift=0
    # columns: id  matrix_status  backlog_status (MISSING when absent on a side)
    while read -r id m b; do
      if [ "$m" != "$b" ]; then
        printf 'DRIFT  %-7s matrix=%-12s backlog=%s\n' "$id" "$m" "$b"
        drift=1
      fi
    done < <(join -a1 -a2 -e MISSING -o '0,1.2,2.2' <(matrix_pairs) <(backlog_pairs))
    if [ "$drift" -eq 0 ]; then
      echo "OK: backlog Sliced Stories statuses match the durable matrix."
    else
      echo "Backlog is out of sync. Reconcile with: scripts/sync-backlog.sh --write" >&2
      exit 1
    fi
    ;;
  --write)
    tmpf="$(mktemp)"; cp "$BACKLOG" "$tmpf"
    while read -r id m; do
      sed -E "s/^(\| ${id} \| [^|]*\| [^|]*\| )(${STATUS_RE})/\1${m}/" "$tmpf" > "$tmpf.2" \
        && mv "$tmpf.2" "$tmpf"
    done < <(matrix_pairs)
    if cmp -s "$tmpf" "$BACKLOG"; then
      rm -f "$tmpf"; echo "No changes — backlog already matches the matrix."
    else
      mv "$tmpf" "$BACKLOG"; echo "Updated $BACKLOG from the durable matrix."
    fi
    ;;
  *)
    echo "usage: scripts/sync-backlog.sh [--check|--write]" >&2
    exit 2
    ;;
esac
