---
title: HVAC: ducts on the 3D tab
summary: Every duct run is also a solid on CadCraft's 3D tab, built from the same run and kept up to date as you draw.
section: tasks
order: 40
keywords: 3d, solid, model, ductwork, elevation, bottom of duct, tag, glb, coordination
---

## The same run in 3D

Each duct run is built as one closed solid on the {{ui:3D}} tab, at its elevation (the bottom of the duct), with its elbows, transitions and branches. It is redrawn in the same step whenever the run changes, so undo takes the 2D and the 3D back together.

The solids carry the tag `HVAC ductwork`: hide or show them all from the 3D tab's tags. Each system has its own color.

## Building them again

{{cmd:DUCT3D}} builds every run's solid again and removes solids whose run is gone. Use it after opening a drawing that was edited without the HVAC add-on (its runs moved, but their solids did not), or after switching solids back on.

Switch solids off in {{ui:Settings}} › {{ui:CadCraft}} › {{ui:HVAC}} › {{ui:Solids on the 3D tab}} for very large drawings; the solids already there stay until you erase them on the 3D tab.

## Without the add-on

A solid is an ordinary 3D group. It saves with the drawing (DWG and DXF), shows on the 3D tab and exports to GLB, OBJ and STL with everything else, with or without HVAC switched on.
