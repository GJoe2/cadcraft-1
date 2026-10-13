---
title: What's new in 0.4
summary: DWG saving in six versions with sheets kept, sheet sets, a rebuilt Properties panel, trim by dragging, lasso selection, split screen and several drawings at once, LISP routines, the Electrical add-on, and many new drafting tools.
section: start
order: 5
keywords: whats new, what's new, release notes, changelog, changes, 0.4, version, new features, dwg versions, sheet sets, properties panel, trim, lasso, split screen, tabs, lisp, appload, aliases, electrical, add-ons, hatch, mtext, linetypes, spanish
---

This is what changed in CadCraft 0.4, compared with 0.3, the version Try ran before. It is the biggest update so far, so the list is grouped by area, with the most important first.

## New

### Saving DWG and DXF

- **Choose the DWG version.** {{ui:Save as}} offers DWG in the AutoCAD 2000, 2004, 2007, 2010, 2013 or 2018 format. A DWG you open saves in its own version. From 2004 on, true colors are kept. See [Open a DWG, edit it and save a copy](topic:open-dwg-save-dxf).
- **Sheets are kept.** A saved DWG now keeps each sheet with its paper, what is drawn on it and its viewports.
- **More survives a save.** Dimensions save as real dimensions that other programs re-measure. Patterned hatches keep their pattern, scale and angle. Named views, the length format, multileaders, linetypes, lineweights and everything the Properties panel sets are kept too.
- **DXF 2000.** A third choice in {{ui:Save as}}: a text DXF that keeps sheets, real dimensions, hatch patterns, true colors, lineweights and linetypes. See [Files: what opens, what saves](topic:files#saving).
- **More comes in.** Multileaders in opened files are editable. Pictures show as a frame with the file name, and wipeouts as their frame, instead of being left out. Big DWGs open in the background, so the page keeps responding.

### Drawing and editing

- **Trim by dragging.** In {{cmd:TRIM}}, drag through the pieces you want gone: every piece the path crosses goes at once, and one Undo puts them back. Rest the pointer on a piece to see it greyed out first. Hold {{key:Shift}} to extend instead. See [Trim and extend](topic:trim-and-extend).
- **Lasso selection.** Press and drag on an empty spot to draw round objects: move right first for a window, left first for a crossing. Press {{key:Space}} while dragging for a fence. See [Lasso selection](topic:lasso-selection).
- **Chamfer, and a fuller Fillet.** {{cmd:CHAMFER}} bevels a corner. {{cmd:FILLET}} now works on arcs, circles and polylines too, and joins parallel lines with a half circle. See [Offset, trim, extend, fillet and chamfer walls](topic:offset-trim-extend-fillet).
- **Hatch.** {{ui:Hatch}} ({{cmd:HATCH}}, `H`) fills an area with a solid fill or a standard pattern. Click inside the area, and closed shapes inside it stay empty. See [Hatch and fill areas](topic:hatch).
- **Stretch, array, join, break and lengthen.** {{cmd:STRETCH}} moves what lies inside a crossing window. {{cmd:ARRAY}} copies in rows and columns or round a center. {{cmd:JOIN}}, {{cmd:BREAK}} and {{cmd:LENGTHEN}} join, cut and resize lines, arcs and polylines. {{cmd:MATCHPROP}} copies one object's properties onto others. See [Move, copy, rotate, scale, mirror, stretch and array](topic:modify-objects).
- **Feet and inches.** Choose {{ui:Length format}} in Current settings, or type {{cmd:UNITS}}: Architectural, Engineering, Fractional or Scientific. Type lengths as `12'6"` or `12'6-1/2"`. See [Units, paper sizes and scales](topic:units-papers-scales).
- **Linetypes and lineweights.** Dashed, hidden, center and the other standard linetypes, and lineweights, for layers and objects. They show in plots. Press {{ui:LWT}} in the status bar to see lineweights on screen too.
- **Area and measuring.** {{cmd:AREA}} measures an outline, a circle, a polyline or a hatch, with a running total. {{cmd:MEASUREGEOM}} measures a distance, radius, angle or area.
- **Polar tracking, object snap tracking and dynamic input.** {{ui:Polar}} ({{key:F10}}), {{ui:Track}} ({{key:F11}}) and {{ui:Dyn}} ({{key:F12}}) in the status bar. See [Snap to points on objects](topic:object-snaps) and [Coordinate and distance entry](topic:coordinate-entry).
- **Zoom previous and named views.** `Z` then `P` goes back to the view before. {{cmd:NAMEDVIEW}} (`NV`) saves the view under a name.
- **Constraints survive mirror and trim.** {{cmd:MIRROR}} and {{cmd:TRIM}} keep the constraints on what is left. See [Constrain a drawing](topic:constraints).

### Selecting

- **Quick select and select similar.** {{ui:Edit}} › {{ui:More}} › {{ui:Quick select}} ({{cmd:QSELECT}}) selects every object that matches a rule, with a live count. {{cmd:SELECTSIMILAR}} selects everything like what you picked.
- **More ways at `Select objects`.** `F` for a fence, `P` for the previous selection, `R` to take objects out. {{key:Tab}} steps through objects on top of each other. See [Select objects](topic:select-objects).

### Text and notes

- **Paragraph text.** {{ui:Paragraph}} ({{cmd:MTEXT}}, `T`) draws a box for the width, then you type straight onto the drawing. Double-click any text to edit it in place. Single-line text is now `DT`.
- **Multileaders.** {{ui:Leader}} ({{cmd:MLEADER}}) draws an arrow, a leader and a note as one object.
- **Revision clouds.** {{cmd:REVCLOUD}} draws a cloud round a rectangle, a polygon, a path you trace, or an object.
- **Find and replace.** {{ui:Edit}} › {{ui:More}} › {{ui:Find and replace}} finds words in text, attribute values and dimension text. See [Add text and labels](topic:text).

### The Properties panel

- **Rebuilt.** Sections you can fold, a divider you can drag, auto-hide, and {{key:Mod+1}} to open it. See [The Properties panel](topic:properties-panel).
- **Many objects at once.** A list at the top picks one kind of object in a mixed selection. Values that differ read Varies, and a new value goes to every object in one undo step.
- **Every point with X, Y and Z,** with a pick button beside each one. Every number field takes expressions and units, such as `=2*45`, `3'6"` or `900mm`.
- **Everything for dimensions,** and transparency, thickness, hyperlinks, text styles, polyline widths and hatch backgrounds. Transparency, widths and backgrounds show on the drawing and in plots.
- **Quick Properties.** {{ui:QP}} in the status bar shows the main properties by the cursor.

### Sheets, sheet sets and plotting

- **Sheet sets.** Gather sheets from many drawings in one numbered list. Fill title blocks from the set, publish the whole set as one PDF, keep a sheet list on the cover sheet, and archive everything as a zip. Type {{cmd:SHEETSET}}. See [Sheet sets](topic:sheet-sets).
- **Every sheet in one PDF.** {{cmd:PUBLISH}}, or {{ui:All sheets in one PDF}} in the Plot dialog, makes one PDF with a page and a bookmark per sheet. See [Plot to PDF](topic:plot-pdf).
- **Flat views of solids.** {{cmd:VIEWBASE}} places front, top, side or isometric views of the 3D solids on a sheet, with hidden lines dashed.

### Several drawings and split screen

- **Several drawings at once.** Opening a drawing, or {{ui:New}}, adds a tab over the drawing area instead of closing what is open. Copy and paste between drawings, tile them side by side, and link their views to compare two revisions.
- **Split the screen.** {{ui:View}} › {{ui:More}} › {{ui:Split side by side}} ({{cmd:VPORTS}}) shows the drawing in two, three or four panes, each with its own zoom. Keep a sheet in one pane beside the model in another. The split is saved with the drawing. See [Split the screen](topic:split-screen).
- **Touch screens.** Pinch to zoom, two fingers to pan, and hold a finger still for Enter. A key row under the command line gives Esc, Undo, Enter and the characters a tablet keyboard hides. On the 3D tab, three fingers orbit. See [Mouse, trackpad and touch](topic:mouse-trackpad-touch).

### Layers, blocks and linked drawings

- **Layer tools by picking.** {{cmd:LAYISO}}, {{cmd:LAYOFF}}, {{cmd:LAYFRZ}}, {{cmd:LAYMCUR}} and more, in the {{ui:Tools}} menu of the Layers panel. Rename, merge and delete layers. Every layer change can be undone. See [Organize a drawing with layers](topic:layers).
- **Count blocks.** {{cmd:COUNT}} counts block references and exports the counts or an attribute schedule as CSV. See [Make and insert blocks](topic:blocks).
- **Define attributes and edit blocks.** {{cmd:ATTDEF}} and the block editor ({{cmd:BEDIT}}). See [Block attributes](topic:attributes).
- **Linked drawings.** {{cmd:XATTACH}} links another drawing, shown read-only with its own layers. {{cmd:XREF}} reloads, binds or detaches it.

### The 3D tab

- **Union, subtract and intersect** solids ({{cmd:UNION}}, {{cmd:SUBTRACT}}, {{cmd:INTERSECT}}).
- **Revolve and sweep** ({{cmd:REVOLVE}}, {{cmd:SWEEP}}), and extrude with a taper or along a path.
- Points snap to the 2D drawing on the ground, a drag selects 2D objects, and the 3D view is saved with the drawing. See [Model in 3D](topic:3d-solids).
- **Open in ModelCraft.** {{ui:View}} › {{ui:More}} › {{ui:Open in ModelCraft}} opens the drawing in the 3D modeling app in a new tab, where that app can take it.

### LISP and your own aliases

- **Run LISP routines.** {{ui:View}} › {{ui:More}} › {{ui:Load application…}} ({{cmd:APPLOAD}}) loads `.lsp` routines and their `.dcl` dialogs, or drop them on the drawing. Their commands work like CadCraft's own. See [Load applications](topic:load-applications) and [Run LISP routines](topic:run-lisp).
- **Command aliases.** {{cmd:ALIASEDIT}} keeps your own aliases in the familiar `LL, *LINE` format, and imports a `.pgp`. See [Edit command aliases](topic:command-aliases).
- **Delete blocks.** {{cmd:DELBLOCKS}} deletes a block's references everywhere, then its definition, in one undo step.

### Add-ons and Electrical

- **Electrical comes with CadCraft.** A free add-on for electrical schematics and installation plans: IEC and ANSI symbols, wires with numbers, device tags, cross-references, terminal, cable and parts lists, circuits and a panel schedule. It is switched on in {{ui:Settings}} › {{ui:General}} › {{ui:Add-ons}}. Its tools are in the {{ui:Electrical}} section of the right panel and in commands that start with `EL`, such as {{cmd:ELSYMBOL}}. Its own help topics start with "Electrical".
- **Add-ons.** Add-ons can add commands, toolbar buttons, panel and Properties sections, and file types ({{cmd:IMPORT}}, {{cmd:EXPORT}}). Data they attach to objects is kept in DWG and DXF.

### In every app

- **Spanish.** {{ui:Settings}} › {{ui:General}} › {{ui:Language}} offers "Español (México)". It is a machine-made draft that has not been reviewed yet. Help topics are still in English. Command options show in your language, and typing the English word still works.
- **Recover your work.** If the tab or browser closes before you save, CadCraft offers your drawings back the next time it starts. See [Recover unsaved work](common:recover).
- **Find a tool.** {{key:Mod+K}} finds a tool, a setting or a help topic. See [Find a tool or setting](common:find-tools).
- **More panel windows.** Give each panel a window of its own, one per monitor. See [Arrange the panels and use a second monitor](common:arrange-panels).

## Improved

- Opening an Archicad project says what it is and how to get a DWG or IFC out of it.
- Hatches with a standard pattern in opened drawings now show their pattern.
- 3D faces inside blocks come into the 3D tab again, once for every reference. In blocks and on sheets they are drawn flat.
- The view cube's words come from the language file.

## Fixed

- Mirroring a block reference put it turned half a turn. It now lands where it belongs.

## Not in this version yet

- You cannot enter a viewport on a sheet to work in the model through it. Edit on the {{ui:Model}} tab instead. Layers frozen in one viewport only are not shown that way yet. Both are planned for 0.5.
- Associative hatches, gradients, text styles with fonts, and spline objects.
- [Not built yet](topic:not-built-yet)
