---
title: Electrical: not built yet
summary: What the Electrical add-on does not do yet, so you know before you plan a project around it.
section: trouble
order: 90
keywords: electrical, not built, missing, limits, roadmap, cross-sheet, potential, plc card, cable, wire colour, cross-section
---

- **Wires as objects.** Wires are lines and polylines on wire layers. They do not carry their own colour or cross-section yet; use the layer name (`EL-WIRE-BU-1.5`).
- **Wires across sheets.** A potential that continues on another sheet is two nets; there is no "continued on" arrow that joins them yet.
- **Whole PLC cards and terminal blocks with several levels.** PLC points are placed one by one; terminals have one level.
- **Symbols of your own.** You can draw your own blocks, but only Electrical's blocks (with the `EL` attribute) are read as devices.
- **Cable cores by colour or number.** The cable list numbers cores in the order the mark crosses them.
- **Voltage drop and cable sizing.** The panel schedule gives current and length, not the voltage drop or the cable size.
- **Installation symbols in 3D.** Plan symbols are 2D.
- **Other languages.** The words are in a language file, but only English is written so far.
