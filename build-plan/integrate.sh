#!/bin/bash
# integrate.sh file:key ...  — card fix, smoke test and verse check for finished games
cd /home/user/Jesus-rises
S=build-plan
fail=0
for fk in "$@"; do
  f=${fk%%:*}; k=${fk##*:}
  node scripts/fix-cards.js $f >/dev/null
  r=$(NODE_PATH=/opt/node-tools/node_modules timeout 300 node build-plan/smoke.js $f $k 2>&1)
  sm=$(echo "$r" | tail -1)
  v=$(node scripts/check-verses.js $f 2>&1 | tail -1)
  echo "$f: $sm | $v"
  if [ "$sm" != "SMOKE OK" ]; then echo "$r" | grep -A8 '"problems"' | head -10; fail=1; fi
  case "$v" in *"mismatches=0 missing(non-KJV)=0"*) ;; *) node scripts/check-verses.js $f | grep -v "^checked" | head -5; fail=1;; esac
done
exit $fail
