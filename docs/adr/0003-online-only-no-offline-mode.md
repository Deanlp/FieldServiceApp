# Online-only: no offline mode

The app assumes a working data connection on every device. We deliberately do not build offline storage and sync for technicians. Offline-first roughly doubles the complexity of every write (conflict resolution, queued actions, stale data), and our technicians work in metro Cape Town where mobile data is generally available.

## Consequences

If a technician has no signal, they wait or update the **Job** later. Adding offline support later means reworking how every screen reads and writes data, so revisit this only if lost signal becomes a real operational problem.
