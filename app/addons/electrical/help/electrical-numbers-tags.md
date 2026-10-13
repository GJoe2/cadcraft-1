---
title: Wire numbers and tags
summary: Number wires by sheet, path and sequence, tag devices in the IEC 81346 style, and keep the numbers you typed yourself.
section: tasks
order: 20
keywords: electrical, wire number, elnumber, eln, numbering, scheme, tag, eltag, iec 81346, designation, plant, location, device tag, lock, terminal number
---

## Number the wires

Type {{cmd:ELNUMBER}} (`ELN`) and press {{key:Enter}}. Every connected net gets one number, placed beside its longest wire on its first sheet. Run it again after changes: numbers that are still right stay, new nets get new ones, and numbers left on no wire are removed.

The scheme is set with `F`, or in {{ui:Settings}} › {{ui:CadCraft}} › {{ui:Electrical}}:

| Scheme | Gives |
|---|---|
| `{sheet}.{path}.{seq}` (default) | `2.4.1`, `2.4.2` … on sheet 2, path 4 |
| `{sheet}{path:02}-{seq}` | `204-1` |
| `W{seq:03}` | `W001`, `W002` … |

`P` switches between one number per net and one number per wire.

To keep a number you typed, select the wire number and switch on {{ui:Keep this number}} in {{ui:Properties}}. A kept number is never given to another net.

## Tags

A tag has three parts: the **plant** (`=A1`), the **location** (`+S1`) and the **device** (`-K3`). The device part is the symbol's {{ui:Tag}}; plant and location come from the sheet's title block unless the symbol has its own. The whole designation names one device: a coil and all its contacts, or the three poles of a breaker drawn apart.

New coils, buttons, lamps, motors and protection devices are tagged when you place them (switch this off in Settings). {{cmd:ELTAG}} tags everything still untagged; `A` tags everything again; `S` chooses the scheme:

- **letter + sheet + path** (default): `-K204` is a relay on sheet 2, path 4; a second one there is `-K204.2`.
- **letter + number**: `-K1`, `-K2` …

The letters follow IEC 81346-2: K relays and contactors, Q power switching, F protection, S switches and buttons, B sensors, M motors, P signals, T transformers, X terminals, A PLC. Contacts are never tagged automatically: they take their coil's tag. Terminals get the strip `-X1` and the next free number.

## Properties

Select a symbol to see its {{ui:Electrical}} section in {{ui:Properties}}: tag, plant, location, function text, maker, part and order number, its full designation, where it is, and where its coil or contacts are. A wire shows its number and what it connects.
