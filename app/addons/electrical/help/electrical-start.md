---
title: Electrical: getting started
summary: What the Electrical add-on does in CadCraft, where its tools are, and how a schematic is kept in an ordinary DWG or DXF file.
section: start
order: 1
keywords: electrical, add-on, schematic, wiring diagram, installation plan, iec 60617, ansi, jic, nfpa 79, elsymbol, elwire
---

## What it is

Electrical is an add-on for CadCraft that comes with it and is free. It does two jobs:

- **Schematics**: control and power circuits drawn with standard symbols, wires that know what they connect, wire numbers, device tags, cross-references between a coil and its contacts, numbered sheets, terminal plans, cable lists and a parts list.
- **Installation plans**: outlets, switches and luminaires placed on a building plan, each on a circuit, the load of every circuit, cable lengths measured along the routes you draw, and a panel schedule.

Switch it on or off in {{ui:Settings}} › {{ui:General}} › {{ui:Add-ons}}. Its tools are in the {{ui:Electrical}} group at the end of the toolbar (with a {{ui:More}} menu), in the {{ui:Electrical}} section of the right panel, and as commands that all start with `EL`.

## Your first schematic

1. Type {{cmd:ELSHEET}}, choose `A3` and give the sheet a title. A sheet opens with a frame, a title block and ten numbered paths across the top.
2. Type {{cmd:ELSYMBOL}} (or `ELS`), choose a group and a symbol, and click where it goes. A coil gets its tag from the path it is on, for example `-K102`.
3. Type {{cmd:ELWIRE}} (or `ELW`) and click from one connection to the next. A wire ends by itself when it reaches a connection or another wire.
4. Place a contact and give it the coil's tag: the coil lists it under itself and the contact says where its coil is.
5. Type {{cmd:ELNUMBER}} to number the wires, and {{cmd:ELCHECK}} to find anything left open.

See [Draw a schematic](topic:electrical-schematics) for the whole walkthrough.

## Files open anywhere

Everything Electrical draws is ordinary CadCraft content: symbols are blocks with attributes, wires are lines and polylines on layers that start with `EL-WIRE`, sheets are layouts with a frame block. So a schematic saved as DWG or DXF opens in any CAD program, and opens in CadCraft without the add-on, with nothing lost. Switching the add-on on again brings back the cross-references and checks.

:::tip
Keep wires on layers named `EL-WIRE`, `EL-WIRE-24VDC`, `EL-WIRE-L1` and so on: any layer whose name starts with `EL-WIRE` holds wires.
:::
