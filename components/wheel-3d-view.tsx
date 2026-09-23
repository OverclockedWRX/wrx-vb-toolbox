import { useEffect, useRef, useState } from "react";
import { formatTire, formatWheel, type TireSpec, type WheelSpec } from "@/lib/stock-wheels";
import { tireDiameterMm } from "@/lib/wheel-math";

type Props = {
  stockTire: TireSpec;
  stockWheel: WheelSpec;
  proposedTire: TireSpec;
  proposedWheel: WheelSpec;
};

type V3 = { x: number; y: number; z: number };
type RGB = [number, number, number];

type Builder = {
  pos: number[];
  nrm: number[];
  col: number[];
  met: number[];
};

const VERT = `
attribute vec3 aPos;
attribute vec3 aNrm;
attribute vec3 aCol;
attribute float aMetal;
uniform mat4 uMvp;
varying vec3 vN;
varying vec3 vCol;
varying vec3 vWorld;
varying float vMetal;
void main() {
  vWorld = aPos;
  vN = aNrm;
  vCol = aCol;
  vMetal = aMetal;
  gl_Position = uMvp * vec4(aPos, 1.0);
}
`;

const FRAG = `
precision mediump float;
varying vec3 vN;
varying vec3 vCol;
varying vec3 vWorld;
varying float vMetal;
uniform vec3 uLight;
uniform vec3 uEye;
void main() {
  vec3 n = normalize(vN);
  vec3 l = normalize(uLight);
  float ndl = dot(n, l);
  if (ndl < 0.0) { n = -n; ndl = -ndl; }
  vec3 v = normalize(uEye - vWorld);
  float specPower = mix(6.0, 28.0, vMetal);
  float specStrength = mix(0.04, 0.42, vMetal);
  vec3 h = normalize(l + v);
  float spec = pow(max(dot(n, h), 0.0), specPower) * specStrength;
  vec3 col = vCol * (0.42 + 0.7 * ndl) + vec3(spec);
  col = pow(max(col, 0.0), vec3(0.92));
  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * Drag-to-orbit preview of both wheels. Geometry is built in millimeters so
 * diameter, width, and offset change the shape you see. No external 3D library.
 */
export function Wheel3DView({ stockTire, stockWheel, proposedTire, proposedWheel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.classList.contains("dark"));
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: true, alpha: false });
    if (!gl) {
      setFailed(true);
      return;
    }
    const el: HTMLCanvasElement = canvas;
    const ctx: WebGLRenderingContext = gl;
    setFailed(false);

    const program = createProgram(gl, VERT, FRAG);
    if (!program) {
      setFailed(true);
      return;
    }

    const stockSpec: TireSpec = { widthMm: stockTire.widthMm, aspect: stockTire.aspect, rimIn: stockTire.rimIn };
    const stockRim: WheelSpec = {
      widthIn: stockWheel.widthIn,
      diameterIn: stockWheel.diameterIn,
      offsetMm: stockWheel.offsetMm,
    };
    const proposedSpec: TireSpec = {
      widthMm: proposedTire.widthMm,
      aspect: proposedTire.aspect,
      rimIn: proposedTire.rimIn,
    };
    const proposedRim: WheelSpec = {
      widthIn: proposedWheel.widthIn,
      diameterIn: proposedWheel.diameterIn,
      offsetMm: proposedWheel.offsetMm,
    };
    const mesh = buildScene(stockSpec, stockRim, proposedSpec, proposedRim, dark);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const stride = 10;
    const data = new Float32Array(mesh.count * stride);
    for (let i = 0; i < mesh.count; i++) {
      const o = i * stride;
      data[o] = mesh.pos[i * 3];
      data[o + 1] = mesh.pos[i * 3 + 1];
      data[o + 2] = mesh.pos[i * 3 + 2];
      data[o + 3] = mesh.nrm[i * 3];
      data[o + 4] = mesh.nrm[i * 3 + 1];
      data[o + 5] = mesh.nrm[i * 3 + 2];
      data[o + 6] = mesh.col[i * 3];
      data[o + 7] = mesh.col[i * 3 + 1];
      data[o + 8] = mesh.col[i * 3 + 2];
      data[o + 9] = mesh.met[i];
    }
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(program, "aPos");
    const aNrm = gl.getAttribLocation(program, "aNrm");
    const aCol = gl.getAttribLocation(program, "aCol");
    const aMetal = gl.getAttribLocation(program, "aMetal");
    gl.enableVertexAttribArray(aPos);
    gl.enableVertexAttribArray(aNrm);
    gl.enableVertexAttribArray(aCol);
    gl.enableVertexAttribArray(aMetal);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, stride * 4, 0);
    gl.vertexAttribPointer(aNrm, 3, gl.FLOAT, false, stride * 4, 12);
    gl.vertexAttribPointer(aCol, 3, gl.FLOAT, false, stride * 4, 24);
    gl.vertexAttribPointer(aMetal, 1, gl.FLOAT, false, stride * 4, 36);

    const uMvp = gl.getUniformLocation(program, "uMvp");
    const uLight = gl.getUniformLocation(program, "uLight");
    const uEye = gl.getUniformLocation(program, "uEye");

    gl.useProgram(program);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(dark ? 0.09 : 0.93, dark ? 0.09 : 0.91, dark ? 0.1 : 0.89, 1);

    const view = {
      yaw: 0.62,
      pitch: 0.36,
      zoom: 1,
      baseDist: mesh.baseDist,
      dragging: false,
      lastX: 0,
      lastY: 0,
    };

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, el.clientWidth);
      const h = Math.max(1, el.clientHeight);
      const width = Math.floor(w * dpr);
      const height = Math.floor(h * dpr);
      if (el.width !== width || el.height !== height) {
        el.width = width;
        el.height = height;
      }
      ctx.viewport(0, 0, el.width, el.height);
    }

    function frame() {
      resize();
      const aspect = el.width / Math.max(1, el.height);
      const dist = view.baseDist * view.zoom;
      const cp = Math.cos(view.pitch);
      const eye = {
        x: mesh.target.x + dist * cp * Math.sin(view.yaw),
        y: mesh.target.y + dist * Math.sin(view.pitch),
        z: mesh.target.z + dist * cp * Math.cos(view.yaw),
      };
      const proj = perspective(0.7, aspect, dist * 0.05, dist * 8);
      const look = lookAt(eye, mesh.target, { x: 0, y: 1, z: 0 });
      const mvp = multiply(proj, look);
      ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT);
      ctx.uniformMatrix4fv(uMvp, false, mvp);
      ctx.uniform3f(uLight, 0.35, 0.9, 0.45);
      ctx.uniform3f(uEye, eye.x, eye.y, eye.z);
      ctx.drawArrays(ctx.TRIANGLES, 0, mesh.count);
      raf = requestAnimationFrame(frame);
    }

    function onPointerDown(event: PointerEvent) {
      view.dragging = true;
      view.lastX = event.clientX;
      view.lastY = event.clientY;
      el.setPointerCapture(event.pointerId);
    }
    function onPointerMove(event: PointerEvent) {
      if (!view.dragging) return;
      const dx = event.clientX - view.lastX;
      const dy = event.clientY - view.lastY;
      view.lastX = event.clientX;
      view.lastY = event.clientY;
      view.yaw += dx * 0.008;
      view.pitch = clamp(view.pitch + dy * 0.006, -0.15, 1.15);
    }
    function onPointerUp(event: PointerEvent) {
      view.dragging = false;
      if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
    }
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      view.zoom = clamp(view.zoom * (event.deltaY > 0 ? 1.08 : 0.92), 0.55, 2.4);
    }
    function onKey(event: KeyboardEvent) {
      const step = 0.08;
      if (event.key === "ArrowLeft") view.yaw -= step;
      else if (event.key === "ArrowRight") view.yaw += step;
      else if (event.key === "ArrowUp") view.pitch = clamp(view.pitch - step, -0.15, 1.15);
      else if (event.key === "ArrowDown") view.pitch = clamp(view.pitch + step, -0.15, 1.15);
      else return;
      event.preventDefault();
    }
    function reset() {
      view.yaw = 0.62;
      view.pitch = 0.36;
      view.zoom = 1;
    }

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("keydown", onKey);
    el.addEventListener("dblclick", reset);

    let raf = requestAnimationFrame(frame);
    const observer = new ResizeObserver(resize);
    observer.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("keydown", onKey);
      el.removeEventListener("dblclick", reset);
      ctx.deleteBuffer(buffer);
      ctx.deleteProgram(program);
    };
  }, [
    dark,
    stockTire.widthMm,
    stockTire.aspect,
    stockTire.rimIn,
    stockWheel.widthIn,
    stockWheel.diameterIn,
    stockWheel.offsetMm,
    proposedTire.widthMm,
    proposedTire.aspect,
    proposedTire.rimIn,
    proposedWheel.widthIn,
    proposedWheel.diameterIn,
    proposedWheel.offsetMm,
  ]);

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-md border border-border">
        <canvas
          ref={canvasRef}
          tabIndex={0}
          className="h-80 w-full touch-none bg-stone-200 outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-stone-900 sm:h-[26rem]"
          aria-label={`Three-dimensional six-spoke preview. Stock ${formatTire(stockTire)} on ${formatWheel(stockWheel)}. Proposed ${formatTire(proposedTire)} on ${formatWheel(proposedWheel)}. Drag to rotate.`}
        />
        {failed ? (
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
            This browser could not start the 3D preview.
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p>Drag to rotate · scroll to zoom · double-click to reset. The dark hub stays fixed so ET shows as poke along the axle.</p>
        <p>
          <span className="mr-3 inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-500" />
            Stock
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-orange-500" />
            Proposed
          </span>
        </p>
      </div>
    </div>
  );
}

function buildScene(
  stockTire: TireSpec,
  stockWheel: WheelSpec,
  proposedTire: TireSpec,
  proposedWheel: WheelSpec,
  dark: boolean,
) {
  const stock = buildWheel(stockTire, stockWheel, [56 / 255, 149 / 255, 211 / 255]);
  const proposed = buildWheel(proposedTire, proposedWheel, [217 / 255, 119 / 255, 6 / 255]);
  const stockR = outerRadiusMm(stockTire, stockWheel);
  const propR = outerRadiusMm(proposedTire, proposedWheel);
  const gap = stockR + propR + 80;
  const stockCx = -gap / 2;
  const propCx = gap / 2;

  const scene = emptyBuilder();
  append(scene, stock, stockCx, stockR, -stockWheel.offsetMm);
  append(scene, proposed, propCx, propR, -proposedWheel.offsetMm);
  append(scene, buildHubAxle(stockWheel), stockCx, stockR, 0);
  append(scene, buildHubAxle(proposedWheel), propCx, propR, 0);

  const ground = dark ? rgb(41, 37, 36) : rgb(214, 211, 209);
  addGroundDisc(scene, stockCx, -2, 0, stockR * 0.72, ground);
  addGroundDisc(scene, propCx, -2, 0, propR * 0.72, ground);

  const minX = stockCx - stockR;
  const maxX = propCx + propR;
  const maxR = Math.max(stockR, propR);
  const target = { x: (minX + maxX) / 2, y: maxR * 0.42, z: 0 };
  const radius = Math.hypot((maxX - minX) / 2, maxR);
  const baseDist = (radius / Math.tan(0.35)) * 0.72;

  return { ...scene, count: scene.pos.length / 3, target, baseDist };
}

function buildWheel(tire: TireSpec, wheel: WheelSpec, accent: RGB) {
  const b = emptyBuilder();
  const rimR = (wheel.diameterIn * 25.4) / 2;
  const outerR = outerRadiusMm(tire, wheel);
  const halfW = (wheel.widthIn * 25.4) / 2;
  const halfTire = tire.widthMm / 2;
  const side = outerR - rimR;
  const tread = halfTire * 0.62;
  const beadZ = halfW * 0.9;
  const rubber = rgb(52, 52, 56);
  const silverDark = rgb(120, 124, 130);
  const rotor = rgb(42, 42, 46);

  revolve(
    b,
    [
      { r: rimR + 1, z: -beadZ },
      { r: rimR + side * 0.16, z: -halfTire * 0.96 },
      { r: rimR + side * 0.48, z: -halfTire },
      { r: outerR - side * 0.06, z: -tread * 1.08 },
      { r: outerR, z: -tread },
      { r: outerR - 2.4, z: -tread * 0.62 },
      { r: outerR, z: -tread * 0.38 },
      { r: outerR - 2.4, z: -tread * 0.14 },
      { r: outerR, z: tread * 0.14 },
      { r: outerR - 2.4, z: tread * 0.38 },
      { r: outerR, z: tread * 0.62 },
      { r: outerR, z: tread },
      { r: outerR - side * 0.06, z: tread * 1.08 },
      { r: rimR + side * 0.48, z: halfTire },
      { r: rimR + side * 0.16, z: halfTire * 0.96 },
      { r: rimR + 1, z: beadZ },
    ],
    48,
    rubber,
    0.05,
  );

  const faceZ = halfW;
  const mountZ = wheel.offsetMm;
  revolve(
    b,
    [
      { r: rimR - 8, z: faceZ - 18 },
      { r: rimR + 9, z: faceZ - 16 },
      { r: rimR + 12, z: faceZ - 5 },
      { r: rimR - 2, z: faceZ - 3 },
    ],
    48,
    accent,
    0.85,
  );
  revolve(
    b,
    [
      { r: rimR - 6, z: -halfW + 3 },
      { r: rimR + 8, z: -halfW + 5 },
      { r: rimR + 8, z: -halfW + 14 },
      { r: rimR - 10, z: -halfW + 16 },
    ],
    32,
    silverDark,
    0.6,
  );
  revolve(
    b,
    [
      { r: rimR - 30, z: -halfW * 0.25 },
      { r: rimR - 22, z: mountZ - 24 },
    ],
    28,
    silverDark,
    0.4,
  );

  const spokeInner = 78;
  const spokeOuter = rimR - 11;
  const zFrontInner = mountZ + 5;
  const zFrontOuter = zFrontInner + 20;
  const spokeFace = rgb(214, 218, 222);
  const spokeEdge = rgb(148, 152, 158);
  for (let i = 0; i < 6; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI * 2) / 6;
    addForgedSpoke(b, ang, spokeInner, spokeOuter, 15, 18, zFrontInner, zFrontOuter, spokeFace, spokeEdge);
  }

  revolve(
    b,
    [
      { r: 33, z: mountZ - 1 },
      { r: 70, z: mountZ - 1 },
      { r: 72, z: mountZ + 7 },
      { r: 33, z: mountZ + 5 },
    ],
    28,
    rgb(150, 154, 160),
    0.75,
  );

  const lugR = 57.15;
  for (let i = 0; i < 5; i++) {
    const ang = -Math.PI / 2 + Math.PI / 5 + (i * Math.PI * 2) / 5;
    addLug(b, lugR, ang, mountZ + 4, mountZ + 11, rgb(214, 216, 220));
  }

  addAnnulus(b, 84, rimR - 28, mountZ - 28, 36, rotor, 0.15, 1);
  addAnnulus(b, 84, rimR - 28, mountZ - 32, 36, rotor, 0.1, -1);

  return b;
}

function outerRadiusMm(tire: TireSpec, wheel: WheelSpec) {
  const rimR = (wheel.diameterIn * 25.4) / 2;
  return Math.max(tireDiameterMm(tire) / 2, rimR + 18);
}

/** Hub flange and axle stay on the car. The wheel is shifted by ET along this axle. */
function buildHubAxle(wheel: WheelSpec) {
  const b = emptyBuilder();
  const halfW = (wheel.widthIn * 25.4) / 2;
  const innerZ = -halfW - wheel.offsetMm - 42;
  const iron = rgb(78, 80, 84);
  const axle = rgb(96, 98, 102);
  revolve(
    b,
    [
      { r: 26, z: innerZ },
      { r: 26, z: 16 },
    ],
    18,
    axle,
    0.55,
  );
  addDisc(b, 0, 0, innerZ, 26, axle, 0.4);
  addAnnulus(b, 0, 26, 16, 18, axle, 0.5, 1);
  revolve(
    b,
    [
      { r: 34, z: -22 },
      { r: 86, z: -22 },
      { r: 88, z: -3 },
      { r: 34, z: -1 },
    ],
    24,
    iron,
    0.4,
  );
  const lugR = 57.15;
  for (let i = 0; i < 5; i++) {
    const ang = -Math.PI / 2 + Math.PI / 5 + (i * Math.PI * 2) / 5;
    addLug(b, lugR, ang, -1, 12, rgb(168, 170, 174));
  }
  return b;
}

function addForgedSpoke(
  b: Builder,
  ang: number,
  innerR: number,
  outerR: number,
  faceHalfInner: number,
  faceHalfOuter: number,
  zInner: number,
  zOuter: number,
  face: RGB,
  edge: RGB,
) {
  const hi = faceHalfInner / innerR;
  const ho = faceHalfOuter / outerR;
  const ci = (faceHalfInner + 6) / innerR;
  const co = (faceHalfOuter + 7) / outerR;
  const bi = (faceHalfInner * 0.42) / innerR;
  const bo = (faceHalfOuter * 0.42) / outerR;
  const zChamI = zInner - 5;
  const zChamO = zOuter - 4;
  const zBackI = zInner - 15;
  const zBackO = zOuter - 12;

  const faceInL = polar(innerR, ang - hi, zInner);
  const faceInR = polar(innerR, ang + hi, zInner);
  const faceOutL = polar(outerR, ang - ho, zOuter);
  const faceOutR = polar(outerR, ang + ho, zOuter);
  const chamInL = polar(innerR, ang - ci, zChamI);
  const chamInR = polar(innerR, ang + ci, zChamI);
  const chamOutL = polar(outerR, ang - co, zChamO);
  const chamOutR = polar(outerR, ang + co, zChamO);
  const backInL = polar(innerR, ang - bi, zBackI);
  const backInR = polar(innerR, ang + bi, zBackI);
  const backOutL = polar(outerR, ang - bo, zBackO);
  const backOutR = polar(outerR, ang + bo, zBackO);

  const tangent = { x: -Math.sin(ang), y: Math.cos(ang), z: 0 };
  const radial = { x: Math.cos(ang), y: Math.sin(ang), z: 0 };

  pushFace(b, [faceInL, faceOutL, faceOutR, faceInR], face, 0.95, { x: 0, y: 0, z: 1 });
  pushFace(b, [faceInL, chamInL, chamOutL, faceOutL], edge, 0.7, scale(tangent, -1));
  pushFace(b, [faceInR, faceOutR, chamOutR, chamInR], edge, 0.7, tangent);
  pushFace(b, [chamInL, backInL, backOutL, chamOutL], edge, 0.45, scale(tangent, -1));
  pushFace(b, [chamInR, chamOutR, backOutR, backInR], edge, 0.45, tangent);
  pushFace(b, [backInL, backInR, backOutR, backOutL], edge, 0.35, { x: 0, y: 0, z: -1 });
  pushFace(b, [faceInL, faceInR, chamInR, chamInL], edge, 0.55, scale(radial, -1));
  pushFace(b, [chamInL, chamInR, backInR, backInL], edge, 0.4, scale(radial, -1));
  pushFace(b, [faceOutR, faceOutL, chamOutL, chamOutR], edge, 0.6, radial);
  pushFace(b, [chamOutR, chamOutL, backOutL, backOutR], edge, 0.4, radial);
}

function addLug(b: Builder, radius: number, ang: number, z0: number, z1: number, color: RGB) {
  const cx = Math.cos(ang) * radius;
  const cy = Math.sin(ang) * radius;
  const segments = 8;
  const r = 8;
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const p0 = { x: cx + Math.cos(a0) * r, y: cy + Math.sin(a0) * r, z: z0 };
    const p1 = { x: cx + Math.cos(a1) * r, y: cy + Math.sin(a1) * r, z: z0 };
    const p2 = { x: cx + Math.cos(a1) * r, y: cy + Math.sin(a1) * r, z: z1 };
    const p3 = { x: cx + Math.cos(a0) * r, y: cy + Math.sin(a0) * r, z: z1 };
    const outward = { x: Math.cos((a0 + a1) / 2), y: Math.sin((a0 + a1) / 2), z: 0 };
    pushFace(b, [p0, p1, p2, p3], color, 0.85, outward);
  }
  addDisc(b, cx, cy, z1, r, color, 0.9);
}

function addDisc(b: Builder, cx: number, cy: number, z: number, radius: number, color: RGB, metal: number) {
  const segments = 20;
  const center = { x: cx, y: cy, z };
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    pushTri(
      b,
      center,
      { x: cx + Math.cos(a0) * radius, y: cy + Math.sin(a0) * radius, z },
      { x: cx + Math.cos(a1) * radius, y: cy + Math.sin(a1) * radius, z },
      { x: 0, y: 0, z: 1 },
      color,
      metal,
    );
  }
}

function addAnnulus(
  b: Builder,
  r0: number,
  r1: number,
  z: number,
  segments: number,
  color: RGB,
  metal: number,
  nz: number,
) {
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const p0 = polar(r0, a0, z);
    const p1 = polar(r1, a0, z);
    const p2 = polar(r1, a1, z);
    const p3 = polar(r0, a1, z);
    const hint = { x: 0, y: 0, z: nz };
    if (nz >= 0) pushFace(b, [p0, p3, p2, p1], color, metal, hint);
    else pushFace(b, [p0, p1, p2, p3], color, metal, hint);
  }
}

function revolve(b: Builder, profile: { r: number; z: number }[], segments: number, color: RGB, metal: number) {
  const count = profile.length;
  const pn = profile.map((_, i) => {
    const a = profile[Math.max(0, i - 1)];
    const c = profile[Math.min(count - 1, i + 1)];
    return normalize2(c.z - a.z, -(c.r - a.r));
  });
  const rings: V3[] = [];
  const norms: V3[] = [];
  for (let i = 0; i <= segments; i++) {
    const th = (i / segments) * Math.PI * 2;
    const c = Math.cos(th);
    const s = Math.sin(th);
    for (let j = 0; j < count; j++) {
      const p = profile[j];
      const n = pn[j];
      rings.push({ x: c * p.r, y: s * p.r, z: p.z });
      norms.push(normalize({ x: c * n.x, y: s * n.x, z: n.y }));
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < count - 1; j++) {
      const i0 = i * count + j;
      const i1 = (i + 1) * count + j;
      const i2 = (i + 1) * count + j + 1;
      const i3 = i * count + j + 1;
      pushTriNormals(b, rings[i0], rings[i1], rings[i2], norms[i0], norms[i1], norms[i2], color, metal);
      pushTriNormals(b, rings[i0], rings[i2], rings[i3], norms[i0], norms[i2], norms[i3], color, metal);
    }
  }
}

function pushFace(b: Builder, verts: V3[], color: RGB, metal: number, outward: V3) {
  let n = triNormal(verts[0], verts[1], verts[2]);
  let order = verts;
  if (dot(n, outward) < 0) {
    order = [...verts].reverse();
    n = triNormal(order[0], order[1], order[2]);
  }
  pushTri(b, order[0], order[1], order[2], n, color, metal);
  if (order.length > 3) pushTri(b, order[0], order[2], order[3], n, color, metal);
}

function pushTri(b: Builder, a: V3, c: V3, d: V3, n: V3, color: RGB, metal: number) {
  const normal = n.x === 0 && n.y === 0 && n.z === 0 ? triNormal(a, c, d) : n;
  pushTriNormals(b, a, c, d, normal, normal, normal, color, metal);
}

function pushTriNormals(b: Builder, a: V3, c: V3, d: V3, na: V3, nc: V3, nd: V3, color: RGB, metal: number) {
  const verts: [V3, V3][] = [
    [a, na],
    [c, nc],
    [d, nd],
  ];
  for (const [p, n] of verts) {
    b.pos.push(p.x, p.y, p.z);
    b.nrm.push(n.x, n.y, n.z);
    b.col.push(color[0], color[1], color[2]);
    b.met.push(metal);
  }
}

function addGroundDisc(b: Builder, cx: number, y: number, cz: number, radius: number, color: RGB) {
  const segments = 28;
  const center = { x: cx, y, z: cz };
  const n = { x: 0, y: 1, z: 0 };
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    pushTri(
      b,
      center,
      { x: cx + Math.cos(a0) * radius, y, z: cz + Math.sin(a0) * radius },
      { x: cx + Math.cos(a1) * radius, y, z: cz + Math.sin(a1) * radius },
      n,
      color,
      0,
    );
  }
}

function append(dst: Builder, src: Builder, tx: number, ty: number, tz: number) {
  for (let i = 0; i < src.pos.length; i += 3) {
    dst.pos.push(src.pos[i] + tx, src.pos[i + 1] + ty, src.pos[i + 2] + tz);
  }
  dst.nrm.push(...src.nrm);
  dst.col.push(...src.col);
  dst.met.push(...src.met);
}

function emptyBuilder(): Builder {
  return { pos: [], nrm: [], col: [], met: [] };
}

function polar(r: number, ang: number, z: number): V3 {
  return { x: Math.cos(ang) * r, y: Math.sin(ang) * r, z };
}

function triNormal(a: V3, b: V3, c: V3) {
  return normalize(cross(sub(b, a), sub(c, a)));
}

function sub(a: V3, b: V3): V3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale(a: V3, s: number): V3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

function dot(a: V3, b: V3) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: V3, b: V3): V3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function normalize(a: V3): V3 {
  const len = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / len, y: a.y / len, z: a.z / len };
}

function normalize2(x: number, y: number) {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

function rgb(r: number, g: number, b: number): RGB {
  return [r / 255, g / 255, b / 255];
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function createProgram(gl: WebGLRenderingContext, vert: string, frag: string) {
  const vs = compile(gl, gl.VERTEX_SHADER, vert);
  const fs = compile(gl, gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function perspective(fovY: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

function lookAt(eye: V3, target: V3, up: V3) {
  const z = normalize(sub(eye, target));
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([
    x.x, y.x, z.x, 0,
    x.y, y.y, z.y, 0,
    x.z, y.z, z.z, 0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1,
  ]);
}

function multiply(a: Float32Array, b: Float32Array) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}
