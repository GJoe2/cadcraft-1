---
title: Piping: valves and P&ID symbols
summary: Put valves, strainers, flanges and unions on pipe runs, and place a P&ID-style set of symbols on their own.
section: tasks
order: 20
keywords: valve, gate, globe, ball, check, butterfly, plug, control valve, strainer, flange, union, p&id, schematic, symbol, pump, relief valve, instrument, balloon
---

## Valves on runs

Type {{cmd:VALVE}} and click on a pipe run; the valve goes where you click, sized to the run (on a double-line run, big enough to show past the pipe). {{ui:Kind}} chooses gate, globe, ball, check, butterfly, plug or control valve, a Y strainer, a flanged joint or a union. {{ui:Remove}} takes the nearest one off. The run's line is broken under each valve, and every valve counts in the schedule by kind and size.

## Symbols on their own

{{cmd:PIDSYM}} places schematic symbols for a process and instrumentation diagram or a riser diagram: the valves above, a three-way valve, a relief valve, a reducer, a cap, a centrifugal pump, instrument balloons (field mounted, or panel mounted with the line through) with their tag — letters over the number, as in `PI 101` — and a flow arrow. {{ui:Angle}} turns the next symbols. Their size is set in {{ui:Settings}} › {{ui:CadCraft}} › {{ui:Piping}}.

The shapes follow the common conventions of these diagrams (ANSI/ISA-5.1 for instrument balloons, ISO 10628-2 for valves and equipment); the drawings are CadCraft's own.
