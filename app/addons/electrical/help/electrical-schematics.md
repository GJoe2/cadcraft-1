---
title: Draw a schematic
summary: Place symbols, draw wires between their connections, and let junctions, cross-references and tags follow as you work.
section: tasks
order: 10
keywords: electrical, schematic, symbol, elsymbol, els, elwire, elw, wire, junction, dot, contact, coil, connection, pin, rotate, terminal, elupdate, elcable, cable
---

## Sheets and paths

A schematic sheet ({{cmd:ELSHEET}}) is a layout with a frame. The numbers across the top and bottom are its **paths**: every symbol and wire is on a sheet and a path, written `2.5` for sheet 2, path 5. Tags, wire numbers and cross-references are made from them. The title block's {{ui:Plant}} (`=`) and {{ui:Location}} (`+`) apply to everything on the sheet.

## Place symbols

1. Type {{cmd:ELSYMBOL}} (`ELS`), or click a symbol in the right panel's {{ui:Electrical}} section.
2. Choose a group (contacts, switches, coils, protection, loads, terminals, PLC) and a symbol. You can also type a symbol's name at the first prompt, for example `coil` or `contact.no`.
3. Type `R` to turn it 90°, then click where it goes. On a sheet it lands on the 2.5 mm grid, so connections line up.

A contact asks for the tag of its coil. Coils, buttons, lamps, motors and protection devices get a tag at once (see [Wire numbers and tags](topic:electrical-numbers-tags)).

Placed on a wire, a symbol cuts the wire under itself, so it sits in the circuit instead of being shorted by it.

## Draw wires

1. Type {{cmd:ELWIRE}} (`ELW`) and click the first connection.
2. Click the next points. With {{ui:Wires go straight across and down}} on (the default) a corner is added for you.
3. The wire ends by itself when you click a connection or another wire; press {{key:Enter}} to end it anywhere else. `U` takes the last point back.

How wires connect:

- A wire ending on a connection, on another wire's end or on another wire's middle is connected. Where three or more meet, a junction dot appears.
- Two wires that only cross are **not** connected.
- A terminal joins its top and bottom.

Junction dots and cross-references update by themselves after every change, inside the same undo step. {{cmd:ELUPDATE}} does it on demand (for a drawing edited elsewhere, or with {{ui:Update cross-references as you draw}} switched off).

## Cross-references

Everything with one designation (`=A1+S1-K1`) is one device. The coil lists its contacts beneath itself (`NO 13-14 /2.5`: a make contact, connections 13-14, on sheet 2 path 5), and every contact says where its coil is (`/1.2`). Move a contact to another sheet and both change. A coil shows eight lines; more contacts end with "and n more", and {{cmd:ELCHECK}} says so.

## Cables

{{cmd:ELCABLE}} draws a cable mark across the wires it carries: click either side of the wires, then give the cable's tag (`-W1`) and type. The cable list shows a core for every wire the mark crosses.
