---
title: Check a schematic
summary: Find duplicate tags, open wire ends, contacts with no coil, shorted symbols and overloaded circuits, and go to each one.
section: tasks
order: 50
keywords: electrical, elcheck, elc, check, error, warning, duplicate tag, open end, unconnected, contact without coil, overload, breaker, circuit, cores
---

Type {{cmd:ELCHECK}} (`ELC`). The history lists every finding, errors first, each with where it is. Type a finding's number to go to it (its sheet opens and its objects are selected); press {{key:Enter}} to end.

| Finding | Means |
|---|---|
| used twice | two coils (or motors, lamps, PLC points) with one designation, or one terminal number twice in a strip |
| PLC address used twice | two PLC points with one address |
| has no tag | a symbol that needs a tag has none; a contact without a tag is an error |
| connected to nothing | a wire end that reaches no connection and no other wire |
| shorts it | a wire runs through a symbol's connection instead of ending on it |
| contacts have no coil | contacts carry a tag no coil has |
| no contact drawn | a coil none of whose contacts is on a sheet (a warning) |
| mirror shows 8 | more contact lines than the coil can list |
| draws … on a … breaker | a circuit's current is over its breaker rating (over 80 % is a warning) |
| on no circuit | an installation device without a circuit |
| no breaker rating | a circuit with loads and no defined breaker |
| more wires than cores | a cable mark crosses more wires than its cores |
| on no wire | a wire number left where no wire is |
