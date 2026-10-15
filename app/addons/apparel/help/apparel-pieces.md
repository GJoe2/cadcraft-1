---
title: Pattern pieces
summary: Make a pattern piece from an outline, and add notches, a grain line, a fold line, drill holes, buttons, buttonholes and internal lines.
section: tasks
order: 10
keywords: piece, notch, grain line, fold, mirror line, drill hole, button, buttonhole, internal line, dart, label, cut quantity
---

## Make a piece

1. Draw the **sew line** as a closed polyline, a circle, or lines and arcs that join end to end.
2. Type {{cmd:PIECE}} and pick it (or pick it first, then type {{cmd:PIECE}}).
3. Give the seam allowance, or {{ui:None}} for a net pattern, and the piece name.

Every corner of the outline is a **corner**; the points along an arc become **curve points**, so curves stay smooth when you move them. The piece gets a grain line through its middle, up the page.

## Marks on a piece

| Command | What it adds |
|---|---|
| {{cmd:NOTCH}} | a notch where you click on an edge: slit, V or T ({{ui:Kind}}), with its depth ({{ui:Depth}}). Notches sit on the cut line and stay the same distance along their edge when the piece changes. |
| {{cmd:GRAIN}} | the grain line, from one click to the next; {{ui:Arrowheads}} chooses both ends, one end or none |
| {{cmd:FOLDLINE}} | the fold line on the edge you click: the piece is cut on the fold, and its label says so |
| {{cmd:DRILL}} | drill holes |
| {{cmd:BUTTON}} | buttons, with their diameter |
| {{cmd:BUTTONHOLE}} | buttonholes, from one end to the other |
| {{cmd:INTLINE}} | an internal line: darts, pocket and placement lines; {{ui:Curve}} makes it a smooth curve |

Each of these asks for the piece first (or uses the selected one), then keeps placing until you press {{key:Enter}}. {{ui:Remove}} takes away the nearest one. One command is one undo step.

## Edit a piece

- Drag a **grip** to move a point of the sew line, an end of the grain or fold line, a drill hole, a button or the label. The cut line and the notches follow.
- In {{ui:Properties}}, the {{ui:Pattern piece}} section has the piece name, style, size, cut quantity, fabric, category, {{ui:Cut as a mirrored pair}}, the grain line's arrowheads and the seam allowance.
- {{cmd:MOVE}}, {{cmd:ROTATE}}, {{cmd:MIRROR}} and {{cmd:COPY}} work on pieces as on any object.

:::note
{{cmd:EXPLODE}} turns a piece into plain lines and text, as in other CAD programs: it is no longer a piece.
:::
