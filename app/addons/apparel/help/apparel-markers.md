---
title: Markers
summary: Lay pieces out on the fabric by hand, with the grain kept, turning and mirroring only where the fabric allows it, and see the marker's length and efficiency.
section: tasks
order: 16
keywords: marker, lay plan, fabric width, efficiency, nap, one-way, grain tolerance, cutting, consumption
---

## Make a marker

1. Type {{cmd:MARKER}}.
2. Give the **fabric width**.
3. Choose the fabric: {{ui:Any way (may be turned)}}, or {{ui:One way (nap or print)}} for velvet, corduroy, a directional print and other fabric where pieces must all point the same way.
4. Give the **grain tolerance** in degrees (0 = the grain exactly along the fabric's length).
5. Click the fabric's lower-left corner and name the marker.

## Bring the pieces

Select the pattern pieces (nothing selected = every piece), type {{cmd:MARKERADD}} and pick the marker. Give the sizes and how many of each, for example `S:1 M:2 L:1`. Each piece comes as many times as its cut quantity says (a mirrored pair comes as a left and a right). They wait in rows above the fabric, already turned so their grain runs along it.

## Lay them out

Move each piece onto the fabric with {{cmd:MOVE}} (or drag it). {{cmd:ROTATE}} turns one round, {{cmd:MIRROR}} flips one. CadCraft puts a piece back where it was, and says why, when it would:

- overlap another piece (touching is fine);
- go off the fabric across a selvedge or the start;
- have its grain line off the fabric's length by more than the tolerance;
- be turned round, or mirrored, on one-way fabric.

Under the fabric the marker shows its **length**, its **efficiency** (the pieces' area against the fabric used) and how many of the pieces are on it.

## Save it

{{cmd:MARKEROUT}} saves the marker as **DXF** (one block per piece on the fabric, and the fabric's outline) for a cutter, or as a **PDF** at full size for a plotter.
