---
title: Piping: drawing pipe runs
summary: Draw pipe runs by material, class and nominal size, single or double line; elbows, reducers, tees and wyes come by themselves.
section: tasks
order: 10
keywords: pipe, run, centerline, nps, dn, schedule 40, schedule 80, type k, type l, type m, elbow, reducer, tee, wye, branch, double line, single line, elevation
---

## Drawing a run

Type {{cmd:PIPE}} and click the points of the run's centerline. Before the first point you can change:

- {{ui:Material}} and {{ui:Class}} — steel Schedule 40 or 80, copper type K, L or M, PVC Schedule 40 or 80, PEX SDR 9 (see [Pipe sizes and where they come from](topic:piping-tables)).
- {{ui:Size}} — a nominal size: `2`, `1-1/2` (or `1 1/2`, `1.5`), or `DN50` in a metric drawing. A size the material is not made in is refused. Changing the size between points makes a reducer.
- {{ui:System}} — domestic cold, hot and hot water return, sanitary, vent, storm, chilled water, heating hot water, natural gas, fire protection or other. Each has its own layer, label and 3D color.
- {{ui:Elevation}} — the centerline's elevation at the start.
- {{ui:Slope}} — for drains (see [Drainage and slope](topic:piping-drainage)).
- {{ui:Lines}} — single line (the centerline, with symbols) or double line (the pipe's outside diameter to scale).
- {{ui:Tag}} — a name such as `CW-1`, shown on the label.

## The fittings it makes

- **Elbows** on every turn: 90° and 45° by name, other angles by their angle. Steel elbows are drawn with the long-radius bend of ASME B16.9 (1.5 × the size from 3/4 in up); other materials' bends are drawn at one outside diameter — a drawing choice, not a fitting's dimension.
- **Reducers** where the size changes, concentric, just after the corner.
- **Tees** where a run starts or ends on another: a tee when it meets the main square (within 15°), a reducing tee when it is smaller, a wye at an angle.

## Changing a run

Drag a point's grip to move it. {{ui:Properties}} › {{ui:Pipe run}} has the tag, system, material and class, size (the whole run), elevation, slope and lines, and shows the run's outside and inside diameter. {{cmd:MOVE}}, {{cmd:ROTATE}}, {{cmd:MIRROR}}, {{cmd:COPY}} and {{cmd:ERASE}} work as on any object.
