---
title: Piping: the pipe and fitting schedule
summary: Pipe by material and size with its length and steel weight, every fitting and valve, and each run's elevations — in the drawing, as CSV, or in TakeoffCraft.
section: tasks
order: 40
keywords: schedule, pipe schedule, fittings, valves, length, weight, csv, takeoffcraft, takeoff, pack, quantities
---

## A table in the drawing

Type {{cmd:PIPESCHED}}; the command line gives the totals and any drains that are too flat; click where the table goes. It lists pipe by material, class and size with its length (and weight, for steel), then every fitting and valve by kind and size with how many, and a total. It keeps itself up to date as the runs change, in the same undo step.

Pipe length is measured center to center through the fittings, along the slope. Steel's weight is the plain-end weight of ASME B36.10M: 10.69 × (D − t) × t pounds per foot (0.0246615 × (D − t) × t kilograms per meter), so 20 ft of 2 in Schedule 40 weighs 73.1 lb.

## A CSV file

{{cmd:EXPORT}} › {{ui:Pipe schedule (CSV)}} writes the pipe (material, size, length, weight), the fittings and valves (count), and each run (tag, system, material, length, its elevation at both ends and its slope).

## In TakeoffCraft

- {{cmd:EXPORT}} › {{ui:Pipes for TakeoffCraft (PDF with the takeoff inside)}} plots the plan on one sheet at a standard scale and puts the takeoff inside the PDF. Open it in TakeoffCraft: one linear item per pipe size with a mark along each stretch of centerline (sloped runs measured along their slope), one count item per fitting and per valve with a mark where it sits, each with its CSI MasterFormat number by system; steel pipe's assembly carries its weight. No rates: those are yours.
- {{cmd:EXPORT}} › {{ui:Pipe assemblies for TakeoffCraft (pack)}} writes the same items without quantities as a pack for {{ui:Library}} › {{ui:Trade packs}} › {{ui:Open a pack file}}.
