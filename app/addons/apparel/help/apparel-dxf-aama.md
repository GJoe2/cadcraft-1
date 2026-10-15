---
title: DXF-AAMA and ASTM pattern files
summary: Save a pattern for other pattern programs, cutters and plotters as DXF-AAMA or ASTM D6673, with its grading, and open patterns other programs saved.
section: tasks
order: 15
keywords: dxf-aama, aama, astm, d6673, rul, grade rule table, export, import, pattern file, cutter, nested grading
---

## Save

1. Select the pieces to save (nothing selected = every piece).
2. Type {{cmd:AAMAOUT}}.
3. Choose {{ui:DXF-AAMA}} or {{ui:ASTM D6673}}. Ask the person you send it to which one their program reads.
4. For graded pieces, choose the grading:
   - {{ui:Rule table (RUL file)}}: the base size in the DXF, the grade rules in a `.rul` file beside it. Send both files.
   - {{ui:Nested: every size drawn}}: every size of every piece in the one DXF. Larger, but nothing to keep together.

Each piece is a block with its cut line, sew line, turn and curve points, notches (slit, T and V), grain line, fold line, drill holes and internal lines on the layers the format uses, and its name, size, quantity, category and fabric as text. Buttons and buttonholes have no layer of their own in the format: they are written as internal lines with a note.

{{cmd:EXPORT}} also offers {{ui:DXF-AAMA pattern, every size drawn (Apparel)}} and the ASTM one.

## Open

Type {{cmd:AAMAIN}} and choose the pattern's DXF file, and its RUL file too when it has one (choose both at once). The pieces come in as pattern pieces:

- the sew line, with the seam allowance read per edge from the distance to the cut line (a piece with only a cut line comes in as a net pattern);
- notches, grain line, fold line, drill holes, internal lines and the piece's text;
- the size range and grade rules from the RUL file, or from the sizes when every size is drawn.

{{cmd:IMPORT}} reads a DXF-AAMA file too (without a RUL file).

:::note
A file CadCraft saved opens again exactly as it was: Apparel keeps its own data in the file beside the drawn lines. Other programs ignore that data.
:::

:::note
A piece with very many sizes and points can be more than one CadCraft piece holds; it then comes in with its curves thinned a little, or in its sample size only, and CadCraft says so.
:::
