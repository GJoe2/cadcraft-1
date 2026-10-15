---
title: Apparel: getting started
summary: What the Apparel add-on does in CadCraft, how to switch it on, and how a pattern is kept in an ordinary DWG or DXF file.
section: start
order: 1
keywords: apparel, add-on, pattern making, sewing pattern, garment, clothing, piece, grading, marker, dxf-aama
---

## What it is

Apparel is an add-on for CadCraft that comes with it and is free. It is for pattern making: you draw the sew line of each pattern piece with CadCraft's own tools, and Apparel turns it into a piece with notches, a grain line, drill holes, buttons and buttonholes, a seam allowance and a label.

It is off until you switch it on: {{ui:Settings}} › {{ui:General}} › {{ui:Add-ons}} › {{ui:Apparel}}. Its tools are in the {{ui:Apparel}} section of the right panel, as commands (below), and, when you ask for it in {{ui:Settings}} › {{ui:CadCraft}} › {{ui:Apparel}}, as a group at the end of the toolbar.

## Your first piece

1. Draw the sew line as a closed polyline ({{cmd:PLINE}} with {{ui:Close}}, or {{cmd:RECTANG}}). Lines and arcs that join end to end work too.
2. Type {{cmd:PIECE}}, pick the outline, give the seam allowance (or {{ui:None}} for a net pattern) and a name.
3. Type {{cmd:NOTCH}} and click on the edges where notches go. Type {{cmd:GRAIN}} to draw the grain line.

See [Pattern pieces](topic:apparel-pieces) for every mark a piece can carry.

## Files open anywhere

A piece is saved as a block reference with its drawing inside, and its data kept with it under the application name `CC_APPAREL`. So a pattern saved as DWG or DXF opens in any CAD program as the drawn piece, and opens in CadCraft without the add-on with nothing lost. With Apparel switched on, the pieces are pieces again.
