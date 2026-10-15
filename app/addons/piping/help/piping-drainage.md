---
title: Piping: drainage and slope
summary: Slope a drain, see its fall and its elevations, and check it against the plumbing code's least slope.
section: tasks
order: 30
keywords: slope, drainage, drain, sanitary, storm, fall, invert, elevation, plumbing code, ipc, 1/4 inch per foot, percent
---

## A sloped run

{{cmd:PIPE}} › {{ui:Slope}} takes inches per foot (`1/4`, `1/8`, `0.125`) in an imperial drawing, or a percent (`2`, `1`) in a metric one; `0` is level. The run falls in the direction you draw it, from the elevation you give at its start. Its plan shows the slope and a flow arrow; its solid on the {{ui:3D}} tab falls with it; the schedule's run table gives its elevation at both ends.

A sanitary or storm drain drawn without a slope takes the least slope the International Plumbing Code (2021, Table 704.1) allows for its largest size:

- 2-1/2 in and smaller: 1/4 in per foot (2 %);
- 3 to 6 in: 1/8 in per foot (1 %);
- 8 in and larger: 1/16 in per foot (0.5 %).

A drain flatter than that is reported by {{cmd:PIPE}} and {{cmd:PIPESCHED}}. Your local code may differ: it is a reminder, not an inspection.

## Lengths along the slope

A sloped run's length in the schedule — and in TakeoffCraft — is measured along the slope: 40 ft at 1/8 in per foot is 40.002 ft of pipe and falls 5 in.

Change a run's slope in {{ui:Properties}} › {{ui:Pipe run}} › {{ui:Slope}}.
