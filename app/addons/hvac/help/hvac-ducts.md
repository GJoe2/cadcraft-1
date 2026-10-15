---
title: HVAC: drawing duct runs
summary: Draw rectangular, round and flat oval duct runs on their centerline; elbows, transitions, tees, takeoffs and laterals come by themselves.
section: tasks
order: 10
keywords: duct, run, centerline, elbow, radius elbow, mitered elbow, transition, reducer, tee, takeoff, lateral, branch, bottom of duct, elevation
---

## Drawing a run

Type {{cmd:DUCT}} and click the points of the run's centerline. While you click, these options change what comes next:

- {{ui:Shape}} — rectangular, round or flat oval (a flat oval lies with its flat sides top and bottom).
- {{ui:Size}} — width × height (`24x12`, `600x300`) or a diameter (`14`). The next sections get it; a size change makes a transition.
- {{ui:Airflow}} — the section's airflow; the add-on sizes it by equal friction (see [Sizing ducts](topic:hvac-sizing)).
- {{ui:Elevation}} — the bottom of the duct, before the first point (9 ft or 2700 mm unless you change it in {{ui:Settings}}).
- {{ui:System}} — supply, return, exhaust, outside air or other. Each has its own layer (`M-HVAC-SUPP`, `M-HVAC-RETN`, `M-HVAC-EXHS`, `M-HVAC-OAIR`, `M-HVAC-DUCT`) and its own color on the {{ui:3D}} tab.
- {{ui:Tag}} — a name such as `S-1`, used by the schedule and the 3D tab.
- {{ui:Undo}} — takes the last point back.

A run holds up to 100 points; start another run from its end for more.

## The fittings it makes

- **Elbows** on every turn. A radius elbow's centerline radius is the duct's width times the run's ratio (1 for rectangular, 1.5 for round and flat oval, as is usual; change it in {{ui:Properties}}). A mitered elbow has a square throat and a miter line; choose it in {{ui:Settings}} or {{ui:Properties}}.
- **Transitions** where the size or shape changes, just after the corner (after its elbow). Each side slopes at most 15° (a default the add-on uses, not a code value), and none is shorter than 6 in or 150 mm. Round to round is called a reducer. The bottom stays flat; the top steps.
- **Branches**: start a run inside another, or end it inside one, and the point moves onto that run's centerline. The branch is cut back to the main's side, gets a 2 in or 50 mm collar, and the main gets an opening there. A round or flat oval branch is a takeoff; a rectangular one is a tee when it meets the main square (within 15°) and a lateral otherwise.

## Changing a run

- Drag a point's grip to move it; the fittings follow.
- {{ui:Properties}} › {{ui:Duct run}}: tag, system, shape, size (the whole run), bottom of duct, elbows, the radius ratio, material and size labels.
- {{cmd:DUCTSIZE}}: pick a section, then size it from its airflow, type a size, or change its shape — for that section or the whole run.
- {{cmd:MOVE}}, {{cmd:ROTATE}}, {{cmd:MIRROR}}, {{cmd:COPY}} and {{cmd:ERASE}} work as on any object. A copy gets its own identity. A branch whose main moves away is no longer connected: draw it to the main again.
