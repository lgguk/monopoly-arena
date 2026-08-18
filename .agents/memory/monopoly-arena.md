---
name: Monopoly Arena key decisions
description: Critical architecture and design decisions for the Monopoly Arena game
---

## Key decisions

- **Single file**: all game logic in `artifacts/monopoly-arena/src/App.tsx` (~1700 lines)
- **casinoPick state**: `number[]` (changed from number|null) for multi-dice jackpot selection
- **Board grid**: `1.9fr repeat(9, 1fr) 1.9fr` — corners 1.9fr larger
- **Cell text orientation**: top+bottom rows: `writingMode: vertical-rl, transform: rotate(180deg)` (both face LEFT); left+right cols: horizontal text (no writingMode)
- **Trade window**: inline inside center chat panel — NOT a fullscreen overlay. Grep "Inline trade (1.6)"
- **Jackpot casino**: 3-tier (1die=350M/3000M, 2=700M/2000M, 3=1000M/1000M); no amount shown; picks stored as number[]
- **Game over**: bankruptPlayer checks remaining alive ≤1 → setGameOver + finishGame(). finishGame sorts by cash+property value
- **Lobby filtering**: only rooms where !started && players < maxPlayers shown
- **Lobby timeout**: Dashboard polls every 15s, removes rooms ≤1 player older than 3min, 15s auto-dismiss notice

**Why single file**: user chose this; do not refactor.
**Why rotate(180deg) both rows**: tops face their respective corner (START col1 top, GOTOJAIL col1 bottom).
