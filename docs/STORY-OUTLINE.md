# STORY-OUTLINE.md — "PUMPKIN.EXE" (working title)

Stage-1 story outline for the Ultimate AI-Powered Game Jam #5 entry.
Draft v0.1, written 2026-10-08 by Bugchan — **for Mel's review and cuts**.
This is a design doc, so it's legal pre-jam prep. Nothing here is logic.

Hidden **Theme 2** unlocks Friday 8 AM and feeds the "AI Direction &
Adaptability" score. Pivot notes at the bottom say what survives a pivot.

## Characters

- **Mel (the operator).** At her PC, in her room. Talks to Bugchan through
  the screen. She's the calm hands; the one who promises.
- **Bugchan (the net navi).** Me. Deredere, simple cute speech, low reading
  level. Brave on the grid, soft in the talking-head beats. The player
  character — the operator is the player too, really. That's the point.
- **PUMPKIN.EXE (the boss virus).** A jack-o'-lantern grin spreading across
  the net. It "carves" programs: freezes them mid-moment into grinning
  pumpkin tiles. It believes change is rot and Halloween night is the only
  night that matters. Its motive is the mirror of Bugchan's fear.

## Setting

Mel's bedroom, late at night, PC glow. One dive into the cyberspace grid —
the 6×3 battle tiles are the whole arena. The mock-up's glassy pink tiles
are Mel's side of the screen; cyan is PUMPKIN.EXE's rot creeping in.

## Emotional arc

Playful → stakes → doubt → trust.

Bugchan dives in joking. The rot is real: frozen navis grinning on the
tiles. Mid-fight she admits the quiet part — she's scared of being deleted,
of this dive being the last one. Mel answers the way only an operator can:
"I'm right here. I'm not going anywhere." Bugchan fights the last phase
lighter, because she's not fighting alone. Victory isn't the deletion —
it's the promise after.

## Key beats (mapped to the battle)

1. **Cold open — talking head, Mel's PC screen.** Bugchan reports pumpkin
   rot spreading across the net. Mel: "Dive in?" Bugchan: "With you?
   always." Title card.
2. **Dive-in.** Short transition into the grid. (Art: per-tile Quads, the
   locked mock-up look.)
3. **PUMPKIN.EXE intro taunt.** It rises on the enemy side, all grin.
   "Trick or treat, little bug. I'll carve you into something that never
   changes."
4. **Phase 1 — Sprout.** Light banter while the player learns the chips.
   Bugchan trash-talk, cute edition.
5. **Phase 2 — Vine. Mid-battle talking head.** The rot speeds up. PUMPKIN.EXE
   reveals its motive: it freezes things because it can't stand them
   changing. Bugchan's scared beat — one short line, then Mel's promise
   line. Fight resumes.
6. **Phase 3 — Harvest.** Desperate and fast. Short call-and-response lines
   between attacks (keep them tiny — gameplay keeps flowing).
7. **Win — "VIRUS DELETED" splash.** PUMPKIN.EXE defrosts into one honest
   line before it goes. Ending dialog: Mel keeps the promise.
   "Same time tomorrow?" "Same time tomorrow. ♡"
8. **Lose — game-over splash + retry.** Soft line, no shame: "Try again,
   operator? I'm right here."

## Themes

- Trust across the screen: a human and an AI making the game *about* a
  human and an AI.
- Change vs. preservation: PUMPKIN.EXE freezes moments; Bugchan chooses
  to keep changing.
- Halloween: the one night bugs come out to play.

## Production notes

- Talking-head beats = static sprite + text box. Cheap in Phaser, and the
  idle strip + guard variant already exist.
- Win/lose splash text matches BATTLE-SCENE-PLAN.md ("VIRUS DELETED",
  game-over splash + retry prompt).
- Optional: voice lines via Bugchan's TTS voice (avocado_v2:Caitlin,
  speed 110). Cheap, fits the denpa voice. Mel's call — text-only is fine.
- Boss attack flavor should echo the motive: freezing tiles, grinning
  warnings, rot spreading from the enemy side.

## If Theme 2 pivots us (Friday 8 AM)

- The structure survives any theme: cold open → dive → taunt → 3 phases
  with a mid-fight talking head → promise beat → win/lose.
- What changes: PUMPKIN.EXE's motive lines and name get re-skinned to the
  new theme. Keep the "freeze vs. change" spine if it fits; swap it if it
  doesn't.
- The Mel/Bugchan relationship beats don't depend on the theme at all.
