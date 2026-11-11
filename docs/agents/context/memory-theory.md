# Memory theory behind the games

MemorizeThis trains the classical **art of memory**. Players already carry their technique in their heads; the app supplies material, controls exposure time precisely, and scores recall fairly. Keep new games true to these ideas.

## Core ideas

- **Method of loci (memory palace).** You place vivid images at known locations along a mental route, then walk the route to recall them in order. The app never models the palace. It controls *how much* material appears and *for how long*, so the player has to place it fast.
- **Chunking.** Working memory holds only a few items, but the items can be big. Grouping digits (2–4 at a time) turns 24 digits into 6–12 chunks. That's why Long Number can separate groups visually.
- **The Major System.** A phonetic code that turns digits into consonant sounds, then into words (e.g. RO: 00 → *sos*, 01 → *sat*, 02 → *sanie*). Each word is an image you can put in the palace. Fluency, meaning instant digit-to-word lookup, is the bottleneck, so it gets its own flashcard trainer.
- **Encoding vs. retrieval.** The memorize phase trains encoding (speed of making images). The delay and recall phases train holding and retrieving. Configurable delays push material from short-term toward medium-term memory.
- **Spaced repetition and active recall.** Retrieving something strengthens it more than re-reading it. Cards you miss should come back soon, and cards you know should come back later (the Leitner box system).
- **Desirable difficulty.** Training is most effective at the edge of ability. The adaptive staircase raises difficulty after a streak of successes and lowers it after misses, which keeps players around a ~70–80% success rate.

## The modules

| Module | Trains | How difficulty scales |
|--------|--------|-----------------------|
| **Long Number** | Chunking and placing digit groups along a palace route; long encoding sessions | Player-chosen length and time (not adaptive) |
| **Number Flash** | Fast encoding of short sequences; digit span | Staircase on length: +1–2 digits after 3–5 right in a row, −1 per miss; display time grows a little per digit |
| **License Plates** | Encoding mixed letter/digit chunks seen in the wild, at different sizes | More plates at once, varied sizes, less time; tilt later |
| **Maze** | Spatial memory and route encoding (the route *is* a palace walk) | Grid size and spike count grow; viewing time can shrink |
| **Card Match** | Spatial location memory; separating memory failure from luck | Grid size grows; preview time can be 0 |
| **Deck Memory** | Memorizing a shuffled deck: card → image (often PAO), images placed along a palace route | Staircase on deck size 4 → 52; memorization time is recorded |
| **Major System Flashcards** | Instant digit↔word recall of the player's own code | Box system (priority queue): misses come back sooner |

## PAO and Speed Cards

**Speed Cards** is a classic memory-sport discipline: memorize the order of a shuffled 52-card deck as fast as possible, then rebuild it. Competitors usually give every card a fixed image, often in a **PAO** system (Person-Action-Object). Each card is a person, an action and an object, so three cards merge into one scene ("Einstein juggling a pineapple"). The scenes are placed one per location along a memory palace route. Deck Memory trains exactly this: exposure, then strict sequence recall, with the memorization time recorded as the sport's key metric.

## Design guidance for new games

- Prefer material the player can encode with their own technique (digits, letters, positions, words). Avoid trivia.
- Exposure time must be exact (`useCountdown`). Hidden-tab time never counts.
- Score recall so that one slip costs one item, not everything after it (`alignStrings`).
- Make difficulty adaptive when the game has a natural size knob.
- Report numbers that show progress over weeks: longest perfect length, accuracy trend, time to answer.
