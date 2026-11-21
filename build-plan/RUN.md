# One scheduled build run

1. `git fetch origin claude/jesus-ascension-game-2rolnh` and make sure the working tree is on that branch and up to date. Commit and push any stray uncommitted work first (it is earlier in-progress game files).
2. Read `build-plan/QUEUE.md`. Take the next two batches that are not `DONE`.
3. For each batch, start a builder agent (general-purpose) with this prompt, filling in the game numbers:
   > Build new mini-games for the Good News Games collection in /home/user/Jesus-rises. First read build-plan/SPEC.md and follow it exactly (house template lost-coin.html, verse rules, tests). Then read build-plan/GAMES.md and build games <numbers>, using the filenames, best keys, Bible references and suggested themes given there. Some of these files may already exist from an interrupted earlier build: read them and finish them rather than starting over. Build one game at a time, finishing and testing each before starting the next. Other agents may be building other games at the same time: only create or edit your own game files, and run no git commands. Report as the spec describes.
4. When a builder reports, check its games: `build-plan/integrate.sh file.html:bestKey ...` (adds the card fix, runs the smoke test and the verse check). Fix small problems yourself; send bigger ones back to the builder with SendMessage.
5. Add each passing game's menu card (title, ref, description from the report, plus an emoji `art` and a gradient `bg`) to its group in `scripts/menu-groups.json`, then run `node scripts/build-menu.js` and `npm run build`.
6. Update `build-plan/QUEUE.md`, commit (with the session's attribution lines) and push to `claude/jesus-ascension-game-2rolnh`.
7. Finish with a short summary for the user: which games went on the menu, what they play like in a line each, and how many batches are left. If a usage limit stops a builder, say so and leave the batch `PARTIAL` for the next run.
8. When every batch is `DONE`, say so and delete this routine (its trigger id is in the session).
