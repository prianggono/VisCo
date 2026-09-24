# VisCo

**Visual Control & Live Production System**

VisCo is being built as a Windows live production application combining broadcast control and visual/deck workflows.

## Current core

The first implementation deliberately focuses on the execution model:

- Deck owns its Layers.
- Deck owns its Transition.
- Program receives a Layer from a Deck and carries that Deck's Transition with the Program state.
- Trigger only describes and executes Actions. It does not own Transition.
- Trigger Actions can target another Deck/Layer.
- Multi-action Trigger sequences are supported.

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

Output engines (LED, Stream, Record) and the desktop UI are intentionally not implemented in this first core step.
