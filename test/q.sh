#!/bin/bash
# usage: test/q.sh '<json>'  -> sends one call, waits for its result, prints it
Q=${Q:-/tmp/hmcp}; n=$(wc -l < $Q/out); echo "$1" >> $Q/in
while [ "$(wc -l < $Q/out)" -le "$n" ]; do sleep 0.3; done; tail -n +$((n+1)) $Q/out | python3 -m json.tool
