# `src/models`

This folder contains Mongoose models and model-adjacent persistence types.

- `Session` stores setup-time and live-session metadata.
- `Match` stores the live scoring record and final result data.
- The other models support communication, settings, or audit trails.

When changing persistence behavior, read the matching model and then the route/helper that loads or writes it.
