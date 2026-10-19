# APEX-UI

An animated **autonomous-agent orb + reasoning-graph** interface — the front-end of
[Apex](https://reznikov-engineering.com/apex), released open source.

Tap the orb to cycle its state (idle → thinking → speaking); the reasoning web reacts,
agent nodes orbit the core, and clicking any node opens an overview card. The orb ring,
agent graph and status bar are **hand-written SVG / CSS**; the cyan particle core is a
small `react-three-fiber` scene (skipped under `prefers-reduced-motion`); and the WebGL
shader backdrop + the overview lamp panel are **MIT community components from
[21st.dev](https://21st.dev/community/components)** (see [CREDITS](./CREDITS.md)).

> ⚠ **The Apex Humanoid is NOT part of this repo.** The particle-figure face of Apex
> (assembly, states, voice-driven energy) lives in a separate repository with its own
> access - what you see here is the orb + reasoning-graph interface only.

> Built with Next.js 15 + React 19. Runtime deps: `lucide-react` (icons) and
> `three` / `@react-three/fiber` / `@react-three/postprocessing` (the particle core) —
> all MIT-licensed.

## Live demo

**[apex-ui-xi.vercel.app](https://apex-ui-xi.vercel.app)** - the same code, running.
Tap the orb.

## Run it yourself

```bash
npm install
npm run dev
# open http://localhost:3000
```

Then `npm run build` for a production build, or deploy to Vercel in one click.

## Files and assistant

The Apex workspace opens on **Files**, with the assistant in a separate tab. In the
browser, the requested folder names are shown for orientation, but the browser cannot
open folders on your laptop. Use the installed Windows desktop app to access them.

The assistant uses OpenAI's `gpt-4.1-mini` through a server-side route. Set
`OPENAI_API_KEY` in `.env.local` (never expose the key in browser code), then restart
the dev server. The overview shows current weather for Paarl, South Africa. Browser
replies use speech synthesis when supported; the Windows desktop app can use either
an installed Windows voice or ElevenLabs.

The file picker can open text files you choose. Their contents are sent to OpenAI
only when you send a message while the file is attached. You can edit the selected
text locally and explicitly save it; browsers that support the File System Access
API ask for write permission, while other browsers download the edited copy. This
web app does not have access to the whole laptop or control desktop applications.

## Windows desktop app

The Windows desktop version adds visible, clickable shortcuts for OneDrive, its
Desktop and Documents folders, Downloads, and the `Church(copy)`, `NOSS`, and `KC`
folders under Documents.
It also offers an explicit filename search, starting with Downloads and those named
folders before searching accessible drive folders. Matches appear while the search
continues, and you can cancel it. Search does not follow directory links, skips
folders Windows denies access to, and stops after 100,000 folders or two minutes.
Apex supports opening `.txt`, `.md`, `.csv`,
`.log`, `.json`, `.pdf`, `.docx`, and `.xlsx` files up to 10 MB; extracted text is
limited to 20,000 characters. PDF and Office files are read-only in Apex, while
plain-text edits require an explicit save confirmation. No file contents are sent
to OpenAI unless you explicitly attach the file and send a chat message.

The Apps list discovers shortcuts pinned to the Windows taskbar and in the user and
shared Start menus, and detects Outlook Classic and Microsoft Store WhatsApp. It
does not inspect running windows or read app contents. Other applications can be
selected from their `.exe` file. Every launch, including voice-requested launches,
requires a native Windows confirmation; Apex does not automate other apps.
The matrix also includes clickable nodes for the seven folders above; selecting one
opens it in the desktop Files workspace.

In the desktop Assistant, press **Start voice**, speak, and press **Stop & send**.
The recording is sent to OpenAI for transcription and submitted as a chat command;
recording is not active in the background. Try “open folder Documents” or “launch
Outlook.” Folder commands only open a connected folder in Files. The assistant reads
a file only after you select it, and file contents are sent to OpenAI only when you
attach the file and send a message.

Install Node.js and npm, then run `npm install`. For development, run `npm run dev`
in one terminal and `npm run desktop:dev` in another. To create the Windows
installer, run `npm run desktop:build`; the installer is written to
`dist-desktop/`. The desktop app asks for your OpenAI key in **Settings** and
stores it encrypted with Windows secure storage. In **Settings**, connect
ElevenLabs with your own API key and voice ID to use its generated audio for spoken
replies; the key is encrypted with Windows secure storage. Spoken reply text is
sent to ElevenLabs and may consume account credits. Without a connected key, Apex
uses the Windows built-in speech voice locally. Use **Test voice** to check audio
playback. Never put either API key in source code or share it in chat.

## What's inside

| Piece | What it does |
|-------|--------------|
| `ApexOrb` | The golden ring frame, waveform and orbit dots (pure SVG) |
| `ApexCore3D` | The cyan particle core (`react-three-fiber` + bloom) |
| `ApexHeroOrb` | Stacks the SVG ring + the particle core, scaled to fit |
| `ReasoningWeb` | The agent constellation — circuit traces, orbit rings, 18-node roster |
| `OrbStatusBar` | The equalizer + STANDBY cluster along the bottom |
| `ShaderBackground` | Animated WebGL "plasma waves" backdrop (MIT component from 21st.dev — see CREDITS) |
| `ApexWorld` | Composes the above; owns the tap-state cycle and the agent overview cards |
| `ApexOverviewPanel` | Top-left HUD: live clock, weather, and social links |
| `app/api/weather` | Keyless [open-meteo](https://open-meteo.com) proxy for the panel's weather |

## Customise

- **Social links** → edit `TILES` in `components/ApexOverviewPanel.tsx`.
- **Weather** → auto-detects the **visitor's** city on Vercel (geo headers); edit `FALLBACK` in `app/api/weather/route.ts` to change the off-Vercel / localhost default.
- **Agents & copy** → the `ROSTER` and `INFO` maps in `components/ApexWorld.tsx`.
- **Backdrop** → the shader in `components/ShaderBackground.jsx`; its opacity/tint are set where `<ShaderBackground>` is used in `ApexWorld.tsx`.

## Accessibility

The decorative SVG graph is mirrored by a real, keyboard-navigable agent list
(`.visually-hidden`), the orb and every control are focusable, and the whole thing
respects `prefers-reduced-motion`.

## Not included (on purpose)

The production Apex page's original voice pipeline, humanoid, personal recordings, and
private story copy are not included. The optional Windows desktop build adds OpenAI chat
and system speech synthesis, but does not include or control that separate production
assistant.

## License

Code is released under the **[MIT License](./LICENSE)** — use it, fork it, ship it.

The **name "Apex" and the Reznikov Engineering branding are not part of this license.**
If you build on this, please use your own product name and branding.

---

Made by [Ruben Mouradian — Reznikov Engineering](https://reznikov-engineering.com).
If you use it, a link back is appreciated (not required).
