# Issue 75 keyboard pattern

## Existing interaction

Radix Tabs owns only the Screens/Windows category switcher. Each category contains a visual
two-column list of mutually exclusive recording sources, followed by Cancel and Share.

## Approved pattern

Treat each visible category's source list as one radio group. Source cards are named radios with
their selected state exposed through `aria-checked` and a roving `tabIndex`, so the group adds one
Tab stop rather than one stop per thumbnail. Space or Enter selects the focused source. Arrow keys
move focus and selection among sources in visual grid order; Tab and Shift+Tab leave the group for
the existing category tabs or dialog actions.

The existing Radix tabs remain tabs and the visual list remains CSS grid layout; no ARIA grid roles
are added. This avoids conflicting tab, radio, and grid interaction models.

## State transitions

- The only public refetch seam is the existing `Reload` button rendered by the empty/load-failed
  state; the populated picker exposes no refresh trigger.
- Reloading from the empty or failed state loads each category as an unchecked radio group: the
  first source of a category is that group's Tab stop, nothing is checked, and Share stays
  disabled until a source is activated.
- Empty and failed loads render the existing Reload button, so focus can continue through the
  dialog and is never trapped in a missing group.
- Share still calls the existing `selectSource` IPC with the selected source; Cancel, thumbnails,
  source naming, category tabs, and capture behavior remain unchanged.

## Test seam

Exercise the rendered picker through roles, accessible names, keyboard events, refresh results,
and the public `electronAPI.selectSource` boundary. Observe the intended failing assertions before
editing production code.
