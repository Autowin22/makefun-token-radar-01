# makefun-token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Autowin22/makefun-token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Autowin22/makefun-token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01)

LaunchScope: a token launch radar over a sealed DefiLlama snapshot of 758 protocols. It ranks 240 pre-token protocols by a market-anchored implied value — TVL × the median mcap/TVL ratio of tokenized peers in the same category, adjusted for 7-day momentum and the length of the protocol's tokenless track record — covers all 40 watchlist protocols, sets the already-trading protocols aside, and gives every row a concrete farm plan with costs and durations. The static dashboard (board, per-protocol detail with the model breakdown, category filter) renders fully offline from the generated data.js.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to-snapshot.json>
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=rkd55ra8&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
