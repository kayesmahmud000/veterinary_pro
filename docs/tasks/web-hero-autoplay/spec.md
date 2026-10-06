# Hero autoplay

Status: Complete — 2026-10-07; evidence in [plan.md](plan.md).

Cycle the existing three hero photos, supporting copy, CTA and selected controls every six seconds, wrapping to the first slide. Keep manual controls and current responsive/overlay layout.

Use a bilingual, keyboard-accessible Play/Pause button with a 44px touch target. Suspend rotation on hover, focus, a hidden browser tab or an off-screen hero; restart with a full interval after interaction. Explicit Play can resume while its button retains focus. Reduced-motion visitors start paused, and enabling reduced motion stops rotation; manual Play remains available. Automatic updates must not create repeated screen-reader announcements. Clean up timers, observers and event listeners on route changes/unmount.

Verify real timing, wraparound, pause/resume/manual selection, keyboard focus, visibility, reduced motion, CTA synchronization, both locales and narrow-screen clearance. Run the web production build, localization checks and scoped formatting/context validation. No new dependencies, image changes, deployment or Git mutation.
