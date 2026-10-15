---
title: HVAC: sizing ducts
summary: Equal-friction duct sizing from the airflow, the formulas the add-on uses and where they come from, and the duct calculator.
section: reference
order: 20
keywords: sizing, equal friction, friction rate, airflow, cfm, velocity, colebrook, darcy, equivalent diameter, huebscher, flat oval, ashrae, calculator
---

## Equal friction

Every section is sized for the same pressure loss per length — the friction rate. Set the rate in {{ui:Settings}} › {{ui:CadCraft}} › {{ui:HVAC}}: 0.1 in. w.g. per 100 ft or 0.8 Pa/m to start (a common starting rate, not a rule). Give a section its airflow ({{cmd:DUCT}} › {{ui:Airflow}}, or {{cmd:DUCTSIZE}}) and the add-on:

1. finds the round diameter that loses exactly that rate at that airflow;
2. rounds it **up** to a stocked size, so the duct loses no more than the rate: round ducts in 1 in steps to 10 in, then 2 in steps; metric 63, 80, 100, 125, 160, 200, 250, 315, 355, 400 mm and on;
3. for a rectangular or flat oval duct, keeps the height you set (12 in or 300 mm unless you change it) and widens it in 2 in or 50 mm steps until its equivalent diameter is at least the round one.

It then says the size, the velocity and the friction rate it really has. A rectangular duct with sides more than 4 to 1 is flagged.

## The formulas

The method and figures are the public ones of the duct design chapter of the ASHRAE Handbook—Fundamentals (2021):

- Friction loss (Darcy–Weisbach): Δp/L = (f / D) × ρV²/2.
- The friction factor from the Colebrook equation: 1/√f = −2 log₁₀(ε / 3.7D + 2.51 / (Re √f)), solved by iteration.
- Standard air: density 1.204 kg/m³ and kinematic viscosity 1.51 × 10⁻⁵ m²/s (20 °C, sea level); Re = V × D / ν.
- Roughness: smooth 0.03 mm (aluminum, PVC, stainless), medium-smooth 0.09 mm (galvanized steel), medium-rough 0.9 mm (fibrous glass duct board), rough 3.0 mm (flexible duct, fully extended). Choose the material in {{ui:Settings}} or {{ui:Properties}}.
- Rectangular ducts: the circular equivalent for equal friction and airflow, Huebscher (1948): De = 1.30 (a × b)^0.625 / (a + b)^0.25.
- Flat oval ducts: Heyt and Diaz (1975): De = 1.55 A^0.625 / P^0.25, with A = πb²/4 + b(a − b) and P = πb + 2(a − b).

Worked examples the add-on is tested against: 1000 cfm in a 12 in round duct moves at 1273 fpm and loses 0.189 in. w.g. per 100 ft; 24 × 12 in is equivalent to 18.3 in round; 1000 cfm at 0.1 in. w.g. per 100 ft needs 13.66 in exactly, so 14 in round or 14 × 12 in rectangular.

## The duct calculator

{{cmd:DUCTCALC}} asks for an airflow and a friction rate and lists the exact round diameter, then the stocked round, rectangular and flat oval sizes with their velocity and friction. It changes nothing in the drawing.

## What sizing does not do

It does not add up fitting losses, balance branches, or check the fan: it sizes each section on its own by friction rate. Check velocities against your project's noise limits.
