# dimma

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

## Ideas

- Add Android TV volume controls through ATS. Extend the ATS server protocol with commands like `volumeUp`, `volumeDown`, `muteToggle`, and optionally `volumeSet`, then handle them on the TV with Android `AudioManager` (`adjustStreamVolume` / `setStreamVolume`). Keep the current intent-based flow for opening SmartTube links. Note: this may not work on devices with Android fixed-volume policy or setups where volume is controlled only by HDMI-CEC / external audio hardware.

This project was created using `bun init` in bun v1.3.0. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
