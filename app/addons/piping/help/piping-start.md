---
title: Piping: getting started
summary: What the Piping add-on does in CadCraft, how to switch it on, and how pipework is kept in an ordinary DWG or DXF file.
section: start
order: 1
keywords: piping, pipe, add-on, plumbing, mechanical, steel, copper, pvc, pex, valve, p&id, schedule, drainage
---

## What it is

Piping is an add-on for CadCraft that comes with it and is free. You click the centerline of a pipe run, and it draws the pipe in its real size — steel, copper, PVC or PEX, by nominal size and schedule or type from the public standards — with its elbows, reducers and tees, the valves you put on it, a slope for drains, a solid on the {{ui:3D}} tab and a line in the pipe and fitting schedule. A P&ID-style symbol set comes with it.

It is off until you switch it on: {{ui:Settings}} › {{ui:General}} › {{ui:Add-ons}} › {{ui:Piping}}. Its tools are in the {{ui:Piping}} section of the right panel, as commands (below), and, when you ask for it in {{ui:Settings}} › {{ui:CadCraft}} › {{ui:Piping}}, as a group at the end of the toolbar.

A drawing in inches or feet names sizes by NPS (`2"`) and measures in feet; any other drawing names steel and PVC by DN (`DN50`), copper and PEX by their nominal size and outside diameter in millimeters, and measures in meters.

## Your first pipe run

1. Type {{cmd:PIPE}}. Type {{ui:M}} for the material, {{ui:Z}} and a size (`2`, `1-1/2`, `DN50`).
2. Click the points of the run. Every corner gets an elbow. Press Enter to finish.
3. To branch off, start the next run on the first one: the click moves onto its centerline and a tee goes there.
4. Type {{cmd:VALVE}} and click on a run to put a valve on it.
5. Type {{cmd:PIPESCHED}} and click where the schedule goes.

## Files open anywhere

A pipe run is saved as a block reference with its drawing inside, and its data kept with it under the application name `CC_PIPING`; so is a symbol. Pipework saved as DWG or DXF opens in any CAD program as drawn, and in CadCraft without the add-on with nothing lost. Its solids are ordinary 3D groups on the {{ui:3D}} tab.
