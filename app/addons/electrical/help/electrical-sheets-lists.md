---
title: Sheets, terminal plans and lists
summary: Add numbered sheets, then make the sheet list, terminal plan, cable list and parts list as tables on new sheets or as CSV files.
section: tasks
order: 30
keywords: electrical, elsheet, sheet, frame, title block, path, elreport, elr, sheet list, terminal plan, terminal list, cable list, parts list, bill of materials, bom, csv, export
---

## Sheets

{{cmd:ELSHEET}} adds a sheet (A3 with ten paths, or A4 with eight). A new sheet takes the project, plant, location and drawn-by values of the first sheet; the title is asked. The title block's fields are the frame's attributes: select the frame and change them in {{ui:Properties}}. Sheet numbers come from the title block's {{ui:Sheet}} field.

## Lists

Type {{cmd:ELREPORT}} (`ELR`) and choose:

| List | What it says |
|---|---|
| `S` Sheet list | every sheet: number, title, plant, location, revision, date |
| `T` Terminal plan | every terminal by strip: its number, wire number, and what its top and its bottom connect to |
| `C` Cable list | every core of every marked cable: wire number, from, to, the cable's type and length |
| `P` Parts list | one row per maker and part number, how many, and which tags use it |

Then `D` puts it on new sheets (as many as it needs, "Parts list (1 of 3)" …), or `V` saves a CSV file. The same four lists are in {{cmd:EXPORT}}.

The parts list reads the maker, part number and order number of each device from the part that has them: the coil for a contactor and its contacts, the device for everything else. Terminals count one by one.

:::note
A CSV cell that starts with `=`, `+`, `-` or `@` (a tag like `-K1`) gets a leading `'`, so a spreadsheet shows it as text and never runs it as a formula.
:::
