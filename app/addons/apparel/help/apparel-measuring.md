---
title: Measuring and seam walking
summary: Measure along a sew line, walk one seam against another to check lengths and notches, and list every piece's perimeter and area in every size.
section: tasks
order: 13
keywords: measure, seam length, seam walking, walk, notch alignment, perimeter, area, piece table, csv, fabric
---

## Length along a sew line

Type {{cmd:SEAMLENGTH}}, pick the piece, then click two places on its sew line. CadCraft gives the length both ways round the piece, and the same in every size when the piece is graded.

## Walk a seam

Seam walking checks that two edges that are sewn together match.

1. Type {{cmd:WALK}}.
2. Click the first piece on the edge to check, then the second piece on its matching edge.
3. CadCraft gives both lengths and the difference, and for each pair of notches how far apart they land. The second edge is drawn laid along the first while you look.

The two pieces are sewn face to face, so the second edge is walked from its far end. {{ui:Reverse}} walks it the other way; {{ui:Size}} checks another size.

## Piece table

{{cmd:PIECETABLE}} lists every pattern piece (or only the selected ones) in every size: the sew line and cut line perimeter and area. {{ui:CSV}} downloads it for a spreadsheet; {{cmd:EXPORT}} offers the same file as {{ui:Apparel piece table (CSV)}}. Areas are in square centimetres, or square inches in a drawing in inches.
