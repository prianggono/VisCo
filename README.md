# VisCo

**Visual Control & Live Production System**

VisCo is being built as a Windows live production application combining broadcast control and visual/deck workflows.

## Current core

The current implementation focuses on the execution model before the desktop UI:

- Deck owns its Layers.
- Deck owns its Transition.
- Program receives a Layer from a Deck and carries that Deck's Transition with the Program state.
- Trigger only describes and executes Actions. It does not own Transition.
- Trigger Actions can target another Deck/Layer.
- Multi-action Trigger sequences are supported.
- Outputs are routed by Deck, never by Layer.
- Default output routing follows Program.
- A Deck target is an explicit output override; its active Layer follows automatically.
- Display output is separate from the shared Media Output Pipeline.
- Stream, Record and Virtual Out share one render source, resolution and FPS, with independent ON/OFF controls.

### Core flow

```
Deck 1 / Layer 2
      |
      v
   Program
      |
      +--> Transition from Deck 1
      |
      v
   Trigger Action
      |
      v
Deck 3 / Layer 2
      |
      v
   Program
      |
      +--> Transition from Deck 3
```

### Output flow

```
                         DECK
                          |
                    Active Layer
                          |
                          v
                      COMPOSITE
                      1x RENDER
                          |
                          v
                 MEDIA OUTPUT BUS
                  Resolution / FPS
               +----------+----------+
               |          |          |
               v          v          v
           STREAMING   RECORDING   VIRTUAL OUT
             ON/OFF      ON/OFF       ON/OFF

Deck / Program --------------------> DISPLAY
```

### Output routing rule

```
Default:
Program -> Display
Program -> Media Output Bus

Override:
Deck 1 -> Display
Deck 2 -> Media Output Bus

Layer selection is never part of output routing.
The active Layer inside the selected Deck follows automatically.
```

### Trigger output controls

Triggers can also control output state:

- Enable/disable an output target.
- Toggle Stream, Record or Virtual Out independently.
- Multi-action sequences can combine output controls with other actions.
- A sequence containing multiple actions is synchronized without duplicating the final Program/Deck output routing step.

## Development

Requirements:

- Node.js 20+
- npm

Commands:

```bash
npm install
npm test
npm run typecheck
```

The desktop UI, media decoding/rendering, capture, display discovery, streaming transport, recording backend, virtual output backend, and hardware acceleration layers are not implemented yet.
