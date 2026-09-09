# Separate SourceSelector keyboard finding (outside issue69)

Fresh installed1.6.0 native observation: source trigger Tab/Return works; Windows
tab receives focus and Right selects it. Subsequent Tab focuses its panel, then
scroll container, then Cancel; Calculator card skipped. Native AX click on the
Calculator image selects it; Share then receives Tab focus and Return works.
No blanket keyboard-only source selection pass is claimed.

Read-only current source investigation at493965e: SourceSelector.tsx lines111-142
renders each card as a div with onClick, without role, tabIndex or onKeyDown.
The surrounding source grid is a plain div. Radix Tabs handles arrow navigation
between Screens/Windows tabs, not selection of descendant cards. There is no
roving tabindex, listbox/radio-group selection handler or arrow-key card behavior
in this component. Thus the omission is a genuine separate keyboard selection gap,
not intentional composite navigation. No source edits made to broaden issue69.
