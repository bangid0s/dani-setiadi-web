# Visual source of truth

Save the "01/ CV" design here as **`cv-reference.jpg`** (PRD §1).

The whole design system in PRD §5 was sampled from that image, and it is the reference for
visual QA at 1440 px and 390 px widths (PRD §13.2, phase 1 exit criteria).

Colours already extracted from it and encoded in `app/globals.css`:

| Token | Hex | Where it appears in the reference |
|---|---|---|
| `cream` | `#F5EFE3` | the page background |
| `signal` | `#F65117` | "Dani Setiadi", "Connect", the pills, the bullets, the pin |
| `ink` | `#13182B` | "Let's", "Experience", "Tools", the script greeting |
| `body` | `#424242` | the bio and description text |

Two assets are still needed from Dani (PRD §16, open questions 3 and 4):

1. **The handwritten "Hi, I'm" lettering as an SVG.** Until it exists the site renders the
   greeting in a script webfont, which is close but not the custom long crossbar. Upload the
   SVG under Hero → Greeting lettering and switch the style to SVG.
2. **A transparent portrait cutout** (PNG or WebP with alpha). The site adds the soft shadow
   itself, so the photo must not carry its own background or edge.
