# User-facing LEVI changes

- Publish user-visible changes through the existing admin broadcast: persistent in-app notice for recipients and WhatsApp only for opted-in recipients, because changes must be presented without overriding SAIR.
- Sentence-prefixed WhatsApp commands that change data must be confirmed via a short-lived, service-only pending command before execution, because casual phrases must never silently change availability.
# LEVI project decisions

- Preserve the home typewriter identity: only the L/E/V/I initials in the top sentence and every rotating word in the home headline stay amber in light and dark themes; change this only on an explicit user request, because generic theme updates previously erased the brand color.
- Keep the home typewriter amber as an independent semantic CSS token rather than using the secondary/amber palette, because the flat theme intentionally neutralizes those general tokens.