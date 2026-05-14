# TLD's Chub Tweaks

Private userscript repository for `TLD's Chub Tweaks.user.js`.

Adds creator-page sorting with count-backed 15-card pagination while preserving Chub's native styling, plus card-page expansion helpers, editor jump shortcuts, action buttons, gallery upload improvements, and notification bell styling.

The creator-page sorter requests `first=15`, reads Chub gateway `count` metadata, and renders its own pagination controls while hiding, not mutating, Chub's native React-owned pagination. For a 76-card creator profile, this yields six pages. Leaving the sorted view restores the native controls.

## Install

Use a userscript manager such as Tampermonkey or Violentmonkey, then install the `.user.js` file from this repository.

