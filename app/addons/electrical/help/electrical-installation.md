---
title: Installation plans and the panel schedule
summary: Place outlets, switches and luminaires on a plan, put them on circuits, measure cable lengths along routes, and balance the panel.
section: tasks
order: 40
keywords: electrical, installation, plan, socket, outlet, switch, luminaire, light, elinstall, eli, circuit, elcircuit, load, elroute, route, cable length, tray, elpanel, panel schedule, elbalance, phase, balance, board, breaker
---

## Place the devices

1. Open the building plan (model space) and type {{cmd:ELINSTALL}} (`ELI`).
2. Choose a group and a symbol: socket outlets, switches and sensors, luminaires, junction boxes, appliances, or a distribution board.
3. Give the circuit (for example `C3`), then click each place; `R` turns the symbol. {{key:Enter}} ends.

Symbols are drawn at the plan's scale: 1:50 for a plan in millimetres, or what you set in {{ui:Settings}} › {{ui:CadCraft}} › {{ui:Electrical}} › {{ui:Plan symbol scale}}. Each symbol carries a planning load in watts (a socket 200 W, a luminaire 60 W …) that you change in {{ui:Properties}}.

Library items placed in the drawing count too when they have electrical data (kilowatts, or amps and volts): put them on a circuit with {{cmd:ELCIRCUIT}}.

## Circuits

{{cmd:ELCIRCUIT}} with `A` puts selected devices on a circuit. With `D` it defines one: description, breaker rating, phase (`L1`, `L2`, `L3`, `L1L2` or `3P`) and board, written on a small label you place next to the board.

## Cable lengths

Draw the routes cables take (trays, conduits, along walls) with {{cmd:ELROUTE}}, or on any layer whose name starts with `EL-ROUTE`. A circuit's cable runs from its board along the shortest routes to each of its devices; a run two devices share is counted once. A device joins the routes when it is within half a metre of one. Half a metre is added at each device and a metre at the board.

## The panel schedule

{{cmd:ELPANEL}} lists every circuit of every board: breaker, phase, load, current, cable and length, the load on each phase and how unbalanced they are. `L` prints it in the history, `D` puts it on a sheet, `V` saves a CSV.

{{cmd:ELBALANCE}} spreads the single-phase circuits over L1, L2 and L3, heaviest first onto the lightest phase. Two- and three-phase circuits stay where they are. One {{key:Mod+Z}} undoes it.
