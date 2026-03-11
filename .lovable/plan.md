

## Plan: Add Copy-to-Clipboard to Code Blocks

### Change

Update the `CodeBlock` component in `src/pages/AIFeatureBuilder.tsx` to add a copy button in the header row next to the label.

**Implementation:**
- Add `useState` for a `copied` flag
- Add a `Button` (ghost, size icon) with `Copy`/`Check` icon next to the label
- On click, call `navigator.clipboard.writeText(code)`, set `copied` to true, reset after 2 seconds
- Import `Copy` and `Check` from lucide-react

Single file change, ~15 lines modified.

