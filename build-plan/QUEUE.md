# Build queue

Work top to bottom. A scheduled run every 5 hours builds the next **two** batches that aren't done. Mark a batch `DONE` here once its games are on the menu.

Status: `TODO` (not started) · `BUILDING` (a builder is on it right now: skip it, and if it's still BUILDING at the next run with no builder running, treat it as PARTIAL) · `PARTIAL` (some files exist from an earlier interrupted build: read them first and finish them rather than starting over) · `DONE`.

| Batch | Games (numbers in GAMES.md) | Group | Status |
|---|---|---|---|
| A | D1, D2, D3 | David | DONE |
| B | M1, M2, M3, M4 | Moses | DONE |
| C | N1, N2, N3, N4 | Noah | BUILDING |
| D | J1, J2, J3 | Jonah | BUILDING |
| E | 1, 2, 3, 4 | Creation | BUILDING (let-there-be-light, seven-days, name-the-animals exist) |
| F | 9, 10, 11 | Noah + Abraham | PARTIAL (all three files exist) |
| G | 12, 13, 14 | Abraham + Jacob | PARTIAL (all three files exist) |
| H | 15, 16, 17 | Jacob | PARTIAL (all three files exist) |
| I | 25, 28, 30, 31 | Moses | PARTIAL (burning-bush exists) |
| J | 32, 33, 34, 35 | Joshua | TODO |
| K | 36, 37, 38 | Gideon | TODO |
| L | 39, 40, 41, 42 | Samson + Ruth | TODO |
| M | 43, 44, 45 | Samuel | TODO |
| N | 52, 53, 54, 55 | David + Solomon | TODO |
| O | 56, 57, 58, 59 | Solomon + Elijah | TODO |
| P | 60, 61, 62 | Elijah | TODO |
| Q | 63, 64, 65, 66 | Elisha | TODO |
| R | 67, 68, 69 | Esther | TODO |
| S | 70, 71, 72, 73 | Nehemiah + Daniel | TODO |
| T | 80, 81, 82, 83 | Jesus (new) | TODO |
| U | 84, 85, 86 | Jesus (new) | TODO |
| V | 87, 88, 89 | Jesus (new) | TODO |
| W | 90, 91, 92 | Early Church | TODO |
| X | 93, 94, 95, 96 | Early Church + Paul | TODO |
| Y | 97, 98, 99, 100 | Paul | TODO |

Already on the menu: Daniel (3), David D1–D6, Joseph 18–23, Moses M1–M4.
