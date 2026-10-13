---
title: Electrical symbols
summary: The symbols Electrical draws in the IEC 60617 set and the ANSI / NFPA 79 set, what each connection is called, and how to switch sets.
section: reference
order: 60
keywords: electrical, symbols, iec 60617, ansi, jic, nfpa 79, elstandard, contact, coil, fuse, breaker, motor, lamp, terminal, plc, earth, transformer, block, attributes
---

## Two sets

New symbols use the set chosen in {{ui:Settings}} › {{ui:CadCraft}} › {{ui:Electrical}} › {{ui:Symbols}}, or with {{cmd:ELSTANDARD}}: **IEC 60617** (the default) or **ANSI / NFPA 79** (the "JIC" style). {{cmd:ELSTANDARD}} `C` redraws every symbol already in the drawing in the chosen set; tags, connections and values stay.

## The symbols

| Group | Symbols (default connection names) |
|---|---|
| Contacts | make contact 13-14, break contact 21-22, changeover 11-12-14, delayed make contact 67-68, three-pole main contact 1-2, 3-4, 5-6 |
| Switches and buttons | pushbutton make 13-14, pushbutton break 11-12, selector switch, manual switch, limit switch |
| Coils | relay or contactor coil A1-A2, timer coil on delay, timer coil off delay |
| Protection and switching | fuse, circuit breaker, three-pole breaker, motor protection breaker, thermal overload relay, disconnector |
| Motors, lamps and loads | three-phase motor U V W, DC motor, signal lamp X1-X2, horn, transformer |
| Terminals and earth | terminal (its number), protective earth |
| PLC | input and output points (with an address) |

## What a symbol is in the file

Each symbol is a block named `EL_IEC_…` or `EL_ANSI_…` with attributes: `TAG`, `FUNC` (plant), `LOC` (location), `DESC` (function text), `MFR`, `PART`, `ORDER`, one per connection (`P1`, `P2` …, its name), `XREF` on contacts and `XREF1`…`XREF8` on coils, `ADDR` on PLC points, and one invisible constant attribute `EL` that says what the block is and where its connections are. Other programs see blocks with attributes; CadCraft without the add-on shows and saves them unchanged.
