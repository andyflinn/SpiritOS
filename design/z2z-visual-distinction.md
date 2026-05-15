# Visual Distinction — Local vs Remote Objects

## Framework Responsibility
The core ZS4 framework (especially tree view / admin UI) MUST clearly show what is local vs remote.

## Implementation

### On the User Record
- Any `Link` object (buddy connection) gets a distinct visual treatment:
  - Icon: 🌐 or 🔗 or 👤 with a small network badge
  - Color tint or border (e.g. subtle blue/purple glow for remote)
  - Tooltip: "Remote Buddy • Live on buddy.z2z.andyflinn.com"

### In Tree Traversal / Object Browser
- Remote objects show a small remote indicator (e.g. "↝ Andy Flinn" or cloud/network icon)
- Local authoritative objects show normal styling
- Cycle-protected or mirrored objects can have secondary badges

## Plugin Apps
- Plugin-level UI/UX is **outside framework scope**
- Apps are free to render remote data however they want (as long as they respect consent)
- Framework only guarantees clear signaling at the core data/tree level

## Accessibility
- ARIA labels and text alternatives must indicate remote status
- High-contrast mode support for remote indicators

This keeps the powerful unified object tree feeling while preventing user confusion about data location and authority.