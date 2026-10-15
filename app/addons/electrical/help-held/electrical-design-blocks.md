---
title: Design blocks
summary: Save part of a schematic once (symbols, wires, wire numbers) and place it again, with new tags and wire numbers.
section: tasks
order: 35
keywords: electrical, design block, elsaveblock, eldesignblock, reuse, copy, starter, circuit, template, retag, renumber
---

A design block is a piece of schematic you use again and again: a motor starter, a lamp circuit, a PLC input with its terminals.

## Save one

1. Select what goes in it: symbols, wires, wire numbers, text and lines.
2. Type {{cmd:ELSAVEBLOCK}} (or `ELSB`), click a base point, and give it a name.

Dimensions, leaders and viewports are left out; CadCraft says how many. Design blocks are kept in this browser.

## Place one

Type {{cmd:ELDESIGNBLOCK}} (or `ELDB`), pick its number, and click where the base point goes. In one step:

- coils, devices and PLC points get new tags from the sheet's path grid (or in sequence, as in {{ui:Settings}});
- a contact whose coil came in the same design block takes that coil's new tag; a contact of a coil outside the block keeps its tag;
- terminals get the next free numbers on their strip;
- the new wires get new numbers, and every wire number already in the drawing stays as it is;
- cross-references and junction dots are worked out again.

One {{key:Mod+Z}} takes the whole design block away.

## Share them

{{cmd:ELDESIGNBLOCK}} `E` saves a design block as an `.elblock.json` file; `I` reads one or more of those files into this browser, and `D` deletes one. A file someone sent is checked before it is used: anything that is not drawing data is left out.

:::note
A design block brings the symbol blocks it uses. If the drawing already has a block with the same name, the drawing's own block is used.
:::
