---
title: Use another symbol library
summary: Turn the blocks of a DWG or DXF symbol library into Electrical symbols that tag, wire and list like the built-in ones.
section: tasks
order: 62
keywords: electrical, import, symbol library, elimportsym, blocks, dwg, dxf, attributes, terminals, connection points
---

If your symbols already live in a DWG or DXF drawing as blocks, you can bring them in instead of redrawing them.

1. Type {{cmd:ELIMPORTSYM}} (or `ELIS`) and choose the drawing.
2. Choose **Suggested types** to import every block whose name says what it is (`RELAY_COIL` is a coil, `PB_NO` a pushbutton, `FUSE_2A` a fuse …), or **One by one** to say for each block which symbol type it is, or skip it.
3. Say whether the library is drawn in millimetres or inches. Inch libraries are scaled to millimetres, the unit Electrical draws in.

Each block then acts as the type you chose: it gets a tag from the path grid, wires connect to it, coils carry the contact mirror and it shows up in the lists. Place them with {{cmd:ELSYMBOL}} › **Imported**. They are kept in this browser for every drawing.

## What is read from a block

- **Connection points:** attributes named like terminals (`TERM01`, `X1TERM02`, `PIN1`, `CONN1`, `T1` …); without them, the ends of the straight leads that stop at the block's outline.
- **Attributes:** a tag (`TAG1`, `DEVICE`, `REF` …), a description (`DESC`, `FUNCTION`), a maker (`MFG`, `MANUFACTURER`), a part number (`CAT`, `PART`, `MODEL`) and an order number are mapped onto Electrical's own, with their default values. Any other attribute comes along unchanged, hidden.

The drawing stays the library's own: {{cmd:ELSTANDARD}} never redraws an imported symbol.

:::note
A block without connection points can still be imported, but wires will not connect to it. {{cmd:ELIMPORTSYM}} says how many there were.
:::
