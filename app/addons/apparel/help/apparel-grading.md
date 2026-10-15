---
title: Sizes and grading
summary: Give a style its size range and base size, put grade rules on points, and see every size stacked in the nest view.
section: tasks
order: 12
keywords: grading, grade rule, size range, base size, nest, sizes, rule table, proportional, flip, copy rule, paste rule
---

## Size range and base size

A style has a **size range** (its sizes in order) and a **base size**: the size you draw the pieces in. Every piece with the same style name shares the range.

1. Select a piece and type {{cmd:GRADE}}, then {{ui:Sizes}}.
2. Type the sizes in order, for example `XS S M L XL` or `34 36 38 40 42`.
3. Give the base size. {{key:Enter}} takes the middle one.

Or use the {{ui:Grading}} section of the right panel: type the range in {{ui:Size range}} and choose the {{ui:Base size}}.

## Grade rules

A **grade rule** belongs to a point and says how far it moves, in x and y, in each size, measured from the base size.

- At {{cmd:GRADE}}, click a point and type its move per size, for example `10,0`: one size up moves it 10 right, one size down 10 left. Type `T` to give each size its own move.
- In the {{ui:Grading}} panel, choose the {{ui:Point}} and type the moves in the table.

A corner with no rule stays where it is. A curve point with no rule moves in proportion between the points of its edge that do move, so curves stay smooth when you grade only the corners. Notches keep their distance along their edge in every size.

## Rule tools

| Tool | What it does |
|---|---|
| {{ui:Copy}} / {{ui:Paste}} | copy one point's rule onto other points (other pieces too, matched by size name) |
| {{ui:Horizontal flip}} / {{ui:Vertical flip}} | turn a rule round in x or y (the other side of a symmetric piece) |
| {{ui:Between, in proportion}} | the points between two points get rules in proportion to their distance along the edge |
| {{ui:Remove}} | the point no longer moves |

## Nest view

{{ui:Nest}} (or the panel's {{ui:Nest view}} switch) draws every size on the base, each in its own colour, so you can check the grading. Change the base size and every size follows.

## The grade rule library

Rules you use again and again (a shoulder, a side seam) can be kept by name. The library is yours: it stays in this browser and works in every drawing.

- **Save:** in the {{ui:Grading}} panel, type a name and choose {{ui:Save}}; or {{cmd:GRADERULE}} › {{ui:Save}} and click the point.
- **Apply:** choose a saved rule in the panel and {{ui:Apply}} it to the point shown; or {{cmd:GRADERULE}} › {{ui:Apply}}, type its name and click the points. A rule saved for other sizes is matched by size name and measured from the piece's base size; sizes the rule does not have stay where the base is. Rules saved in millimetres work in a drawing in inches, and the other way round.
- **Export / Import:** {{cmd:GRADERULE}} › {{ui:Export}} writes the library as JSON (everything) or as a RUL file (the rules that share one size range); {{ui:Import}} reads either, so another program's rule table becomes rules you can apply.
