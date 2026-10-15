---
title: HVAC: ducts in TakeoffCraft
summary: Send the duct schedule to TakeoffCraft as items — a PDF of the plan with the takeoff inside, or the assemblies as a pack for your price library.
section: tasks
order: 50
keywords: takeoffcraft, takeoff, estimate, quantities, items, pack, price library, sheet metal, pdf
---

## A PDF with the takeoff inside

{{cmd:EXPORT}} › {{ui:Ducts for TakeoffCraft (PDF with the takeoff inside)}} plots the plan on one sheet (ARCH D or ISO A1, at the largest standard scale that fits) and puts a TakeoffCraft takeoff inside the PDF. Open the PDF in TakeoffCraft and it offers the takeoff:

- one **linear item** per duct shape, size and material, with a mark along every straight piece;
- one **count item** per fitting and size, with a mark where each one sits;
- each item's assembly has its **sheet metal**: the duct's perimeter × L, or the fitting's area × N.

TakeoffCraft measures the marks at the sheet's scale, so its lengths are the schedule's lengths, and you can see on the sheet what each one is. The scale is set and checked against the longest duct piece. Items have no rates: a rate is yours to set.

## The assemblies as a pack

{{cmd:EXPORT}} › {{ui:Duct assemblies for TakeoffCraft (pack)}} writes the same items without quantities as a TakeoffCraft pack (a `.json` file). In TakeoffCraft open {{ui:Library}} › {{ui:Trade packs}} › {{ui:Open a pack file}} to add them to your price library. Each item notes the quantity it had in the drawing.
