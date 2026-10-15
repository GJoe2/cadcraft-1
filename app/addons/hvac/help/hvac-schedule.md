---
title: HVAC: the duct schedule
summary: Straight duct by size and material, every fitting, and the sheet metal area of each, as a table in the drawing or a CSV file.
section: tasks
order: 30
keywords: schedule, duct schedule, sheet metal, surface area, square feet, fittings, csv, quantities, length
---

## A table in the drawing

Type {{cmd:DUCTSCHED}}. The command line gives the totals; click where the table goes (its top left corner). The table lists:

- **straight duct** by shape, size and material, with its length and sheet metal area;
- **fittings** — elbows, transitions and reducers, tees, takeoffs and laterals — by kind and size, with how many and their sheet metal;
- a total.

The table keeps itself up to date: every change to a duct run changes it in the same step (and {{cmd:UNDO}} takes both back). Its text height is set in {{ui:Settings}} › {{ui:CadCraft}} › {{ui:HVAC}}.

## How the sheet metal is worked out

- Straight duct: its perimeter × its length. A 24 × 12 in duct 10 ft long has 6 ft × 10 ft = 60 ft².
- Elbows: the perimeter × the centerline length. For a radius elbow this is exact: the two cheeks, the heel and the throat add up to just that. A 90° 24 × 12 in elbow with a 24 in radius has 18.85 ft².
- Rectangular transitions: their four flat sides, each worked out exactly.
- Round and mixed-shape transitions: the average perimeter × the slant length (exact for a round reducer centered on both ends, close for the others).
- A branch's takeoff or tee: its collar, the branch's perimeter × 2 in (50 mm).

Seams, laps and waste are not included: add them in TakeoffCraft as waste, or by your shop's own rule.

## A CSV file

{{cmd:EXPORT}} › {{ui:Duct schedule (CSV)}} writes three tables: the straight duct (shape, size, material, length, perimeter, area), the fittings (count, area each, area), and every section (tag, system, size, length, airflow, velocity, friction).

To estimate from the schedule, see [Ducts in TakeoffCraft](topic:hvac-takeoff).
