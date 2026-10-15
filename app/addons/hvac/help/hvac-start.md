---
title: HVAC: getting started
summary: What the HVAC add-on does in CadCraft, how to switch it on, and how ductwork is kept in an ordinary DWG or DXF file.
section: start
order: 1
keywords: hvac, add-on, ductwork, duct, mechanical, sheet metal, airflow, cfm, equal friction, schedule
---

## What it is

HVAC is an add-on for CadCraft that comes with it and is free. It draws ductwork: you click the centerline of a duct run, and the add-on draws both sides of the duct with its elbows, transitions and branch fittings, sizes it from the airflow, builds it as a solid on the {{ui:3D}} tab and lists it in a duct schedule with its sheet metal area.

It is off until you switch it on: {{ui:Settings}} › {{ui:General}} › {{ui:Add-ons}} › {{ui:HVAC}}. Its tools are in the {{ui:HVAC}} section of the right panel, as commands (below), and, when you ask for it in {{ui:Settings}} › {{ui:CadCraft}} › {{ui:HVAC}}, as a group at the end of the toolbar.

Sizes follow the drawing's units: a drawing in inches or feet gets sizes in inches, airflow in cfm and friction in inches of water per 100 feet; any other drawing gets millimeters, liters per second and pascals per meter.

## Your first duct run

1. Type {{cmd:DUCT}}. Type {{ui:Z}} and a size, for example `24x12` (width × height) — or {{ui:A}} and the airflow, and the add-on picks the size.
2. Click the points of the run. Every corner gets an elbow by itself. Press Enter to finish.
3. To branch off, start the next run inside the first one: the click moves onto its centerline and the branch gets a tee or a takeoff there.
4. Type {{cmd:DUCTSCHED}} and click where the schedule goes.

See [Drawing duct runs](topic:hvac-ducts) for everything a run can do.

## Files open anywhere

A duct run is saved as a block reference with its drawing inside, and its data kept with it under the application name `CC_HVAC`. So ductwork saved as DWG or DXF opens in any CAD program as the drawn duct, and opens in CadCraft without the add-on with nothing lost. Its solids are ordinary 3D groups on the {{ui:3D}} tab. With HVAC switched on, the runs are duct runs again.
