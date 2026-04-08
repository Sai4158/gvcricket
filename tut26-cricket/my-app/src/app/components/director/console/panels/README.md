# `director/console/panels`

These files render the major director console sections without owning the runtime behind them.

## Start here

- State owner: `../DirectorConsoleScreen.jsx`
- Hook owners: `../hooks`

## Main entry

- `DirectorConsoleEntrySection.jsx`: auth and session-selection hero states
- `DirectorLoudspeakerPanel.jsx`: PA hold-to-talk UI
- `DirectorWalkiePanel.jsx`: director walkie UI and push-to-talk control
- `DirectorSoundEffectsPanel.jsx`: sound-effect deck
- `DirectorYouTubeDeckPanel.jsx`: YouTube playlist and deck UI
- `DirectorScoreAnnouncerPanel.jsx`: speech-announcer controls
- `DirectorAudioOutputPanel.jsx`: audio-output instructions

## Read this folder when

- The UI structure matters more than the underlying side effects
- You want the panel that owns a specific visible director control
- The screen file should only coordinate data and cross-panel behavior

## Run this command

```bash
npm run lint
```
