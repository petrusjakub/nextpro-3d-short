// "The Bridge That Fell for a Song": our original 67 s short in the flat-characters-in-a-3D-toon-world style.
// One three.js world (world.ts) posed per frame from the story timeline (story.ts). Post chain (look-match pass):
//   InkPass (world ink lines, own pass) -> lens blur pre + main (thin-lens DOF per shot from dofAt) ->
//   [bloom (emissive only) + NEUTRAL tone mapping + colour grade] (one merged EffectPass), MSAA 4.
// Ink runs before the DOF so lines blur with what they belong to; bloom after the DOF so glows defocus with their
// source; the grade is display-referred, so it comes after tone mapping. Every pixel-sized parameter is specified at
// 1080x1920 and scaled with the output size, so stills at --scale 0.5 and the 1440x2560 final match.
// Place changes crossfade by stacking a second canvas for the fade frames; the hook ends on a 4-frame white flash.
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, Audio, continueRender, delayRender, getInputProps, staticFile, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { World, loadKit } from "./world";
import { InkPass, noInkFallback } from "./ink";
import { LensBlur, GrainEffect } from "./lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH, gradeFor } from "./grade";
import { Kit } from "./build";
import { TOTAL, FLASH_AT, SHOTS, layersAt, dofAt } from "./story";
import { WORDS, Word } from "./words";

export const NEXTPRO_FRAMES = TOTAL;

/** v2 subtitles: group words.json into cues of <= 2 lines, <= 42 chars/line, <= ~3.2 s each */
type Cue = { start: number; end: number; lines: string[] };
const buildCues = (words: Word[]): Cue[] => {
  const cues: Cue[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (!cur.length) return;
    const text = cur.map((w) => w.word).join(" ");
    const lines: string[] = [];
    let line = "";
    for (const w of text.split(" ")) {
      if (line && line.length + 1 + w.length > 42) { lines.push(line); line = w; }
      else line = line ? `${line} ${w}` : w;
    }
    if (line) lines.push(line);
    cues.push({ start: cur[0].start, end: cur[cur.length - 1].end, lines: lines.slice(0, 2) });
    cur = [];
  };
  for (const w of words) {
    const text = [...cur, w].map((x) => x.word).join(" ");
    const tooLong = text.length > 80;
    const tooSlow = cur.length > 0 && w.end - cur[0].start > 3.2;
    const gap = cur.length > 0 && w.start - cur[cur.length - 1].end > 0.6;
    if (cur.length > 0 && (tooLong || tooSlow || gap)) flush();
    cur.push(w);
    if (w.word.endsWith(".") && cur.length >= 4) flush();
  }
  flush();
  return cues;
};
const CUES = buildCues(WORDS);
const cueAt = (t: number) => CUES.find((c) => t >= c.start - 0.05 && t < c.end + 0.12);

/** v2 brand pill (top of frame, clear of the bottom subtitles) */
const pill: React.CSSProperties = {
  fontFamily: "Arial, sans-serif", fontWeight: 800, color: "#ffffff",
  background: "rgba(6, 42, 48, 0.88)", borderRadius: 999, padding: "14px 28px", fontSize: 40,
};
const JALUR = ["Karyawan Swasta", "Agen Properti", "NEXTGrowth Partners"];
/** which jalur card is highlighted by the narration (word times in voice/words.json) */
const jalurActive = (t: number) => (t >= 31.8 && t < 32.6 ? 0 : t >= 32.7 && t < 33.4 ? 1 : t >= 33.7 && t < 36.2 ? 2 : -1);

/** A/B switches for test stills only (Remotion inputProps `{ post: { ink: false, ... } }`); everything is on by default. */

/** Bloom for emissive sources only (depth.md 6.4). Its MIP chain always starts at 540x960 (half of 1080x1920),
 *  whatever the output size, so the glow keeps the same size relative to the frame (e-fold ~30 px at 1080p,
 *  ~1.5 % of the frame height) at 540, 1080 and 1440 widths. ADD blend: HDR-safe (SCREEN darkens values > 1). */
const makeBloom = () => {
  const b = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.5, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 });
  const mip = b.mipmapBlurPass;
  const setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};

const fwd = new THREE.Vector3(), fpt = new THREE.Vector3();

const useKit = () => {
  const [kit, setKit] = useState<Kit | null>(null);
  const [handle] = useState(() => delayRender("bridge kit"));
  useEffect(() => { loadKit().then((k) => { setKit(k); continueRender(handle); }); }, [handle]);
  return kit;
};

const Inner: React.FC<{ id: number; kit: Kit }> = ({ id, kit }) => {
  const f = useCurrentFrame();
  const { camera, scene } = useThree();
  const world = useMemo(() => new World(kit), [kit]);
  const target = useMemo(() => new THREE.Vector3(), []);
  const fx = useMemo(() => ({
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera),
    lens: new LensBlur({ maxCoC: 24, nearScale: 1.2 }),
    bloom: makeBloom(),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(GRADES.day, GRADE_STRENGTH.day),
    grain: new GrainEffect({ amount: 0.025, cellPx: 1.5 }), // film grain, OFF by default (inputProps post.grain): the reference measures no grain and it quadruples the file size
  }), [camera, scene]);
  useEffect(() => () => fx.ink.dispose(), [fx]);
  const cam = camera as THREE.PerspectiveCamera;
  target.copy(world.update(id, f, cam, scene));
  noInkFallback(world.root);
  // thin-lens focus: distance along the view axis to the shot's focus point (default: the camera's look target)
  const d = dofAt(f);
  cam.getWorldDirection(fwd);
  if (d.focus) fpt.set(...d.focus(f)); else fpt.copy(target);
  fx.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
  fx.lens.cInf = d.cInf;
  gradeFor(fx.grade, SHOTS[id - 1].light);
  fx.grain.seed = f; // deterministic per frame
  return (
    <>
      <primitive object={world.root} dispose={null} />
    </>
  );
};

/** test stills only: inputProps `{ post: { dpr: 0.5 } }` forces the WebGL buffer size (R3F clamps dpr to >= 1 by default) */
const dprOverride = () => (getInputProps() as { post?: { dpr?: number } }).post?.dpr;
const ShotView: React.FC<{ id: number; kit: Kit; alpha: number }> = ({ id, kit, alpha }) => (
  <AbsoluteFill style={{ opacity: alpha }}>
    <ThreeCanvas width={1080} height={1920} {...(dprOverride() ? { dpr: dprOverride() } : {})} gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
      camera={{ fov: 40, near: 0.2, far: 1500 }}>
      <Inner id={id} kit={kit} />
    </ThreeCanvas>
  </AbsoluteFill>
);

export const NextProShort: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 30;
  const kit = useKit();
  if (!kit) return null;
  const flash = f >= FLASH_AT && f < FLASH_AT + 4 ? [1, 0.75, 0.45, 0.2][f - FLASH_AT] : 0;
  const endCard = f >= TOTAL - 150; // last 5 s: CTA end card (only on-screen text in the video)
  const cue = cueAt(t);
  const jalur = jalurActive(t);
  return (
    <AbsoluteFill style={{ background: "#cfe3f2" }}>
      {layersAt(f).map((l, i) => <ShotView key={i ? "over" : "base"} id={l.id} kit={kit} alpha={l.alpha} />)}
      {flash > 0 && <AbsoluteFill style={{ background: "#ffffff", opacity: flash }} />}
      {/* v2 brand texts at different spots (top, clear of the subtitles) */}
      {f >= 30 && f < 300 && (
        <div style={{ position: "absolute", top: 64, left: 48, ...pill }}>@pasti.jaga</div>
      )}
      {f >= 824 && f < 1094 && (
        <div style={{ position: "absolute", top: 64, left: "50%", transform: "translateX(-50%)", ...pill, color: "#ffd166" }}>pastijaga.biz.id</div>
      )}
      {f >= 1633 && f < 1875 && (
        <div style={{ position: "absolute", top: 64, left: "50%", transform: "translateX(-50%)", ...pill }}>WA 087781896087</div>
      )}
      {/* v2 beat 6: the 3 verified NextPro jalur as cards, highlighting the one being named */}
      {f >= 824 && f < 1094 && (
        <div style={{ position: "absolute", top: 300, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          <div style={{ fontFamily: "Arial, sans-serif", fontSize: 36, fontWeight: 800, color: "#ffffff", background: "rgba(6, 42, 48, 0.88)", borderRadius: 999, padding: "12px 26px" }}>
            Ada 3 jalur NextPro:
          </div>
          {JALUR.map((j, i) => (
            <div key={j} style={{
              fontFamily: "Arial, sans-serif", fontSize: 38, fontWeight: 800, textAlign: "center", width: 780,
              color: jalur === i ? "#062a30" : "#ffffff",
              background: jalur === i ? "#ffd166" : "rgba(6, 42, 48, 0.88)",
              borderRadius: 20, padding: "18px 24px",
            }}>
              {j}{i === 2 ? " — travel haji & wakaf" : ""}
            </div>
          ))}
        </div>
      )}
      {/* v2 burned-in subtitles (bottom, hidden under the end card) */}
      {!endCard && cue && (
        <div style={{
          position: "absolute", bottom: 150, left: "50%", transform: "translateX(-50%)", width: "92%",
          textAlign: "center", fontFamily: "Arial, sans-serif", fontSize: 46, fontWeight: 700, lineHeight: 1.25,
          color: "#ffffff", background: "rgba(0, 0, 0, 0.45)", borderRadius: 14, padding: "12px 20px",
          textShadow: "0 2px 0 #000, 2px 0 0 #000, -2px 0 0 #000, 0 -2px 0 #000, 0 0 10px rgba(0,0,0,0.9)",
        }}>
          {cue.lines.map((ln, i) => <div key={i}>{ln}</div>)}
        </div>
      )}
      {endCard && (
        <AbsoluteFill style={{ background: "#062a30", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
          <div style={{ fontFamily: "Arial, sans-serif", color: "#ffffff", fontSize: 64, fontWeight: 800, textAlign: "center", lineHeight: 1.15 }}>
            Jadi Partner NextPro
          </div>
          <div style={{ fontFamily: "Arial, sans-serif", color: "#ffd166", fontSize: 72, fontWeight: 800, textAlign: "center", marginTop: 36 }}>
            pastijaga.biz.id
          </div>
          <div style={{ fontFamily: "Arial, sans-serif", color: "#ffffff", fontSize: 58, fontWeight: 700, textAlign: "center", marginTop: 28 }}>
            WA 0877-8189-6087
          </div>
          <div style={{ fontFamily: "Arial, sans-serif", color: "#bfe3e0", fontSize: 34, textAlign: "center", marginTop: 28 }}>
            Manulife NextPro
          </div>
        </AbsoluteFill>
      )}
      <Audio src={staticFile("voice/narration.mp3")} />
    </AbsoluteFill>
  );
};
