import type { CSSProperties, ReactNode } from 'react'
import type { Season } from '../theme'

/**
 * 헤더 전체를 채우는 계절 풍경 (viewBox 800×200, 아래·가운데 기준으로 잘라 채움).
 *
 * 화면별로 보이는 영역 (viewBox 좌표):
 *  - 휴대폰: x 172–628, y 0–153 (그 아래는 카드가 덮음)
 *  - 넓은 화면: x 0–800, y 58–200
 * 글자 자리: 앱 이름·제목은 왼쪽 위(x 172–410, y 0–112), 월 이동은 오른쪽 위(x 418–628, y 0–48)
 * → 그 자리는 하늘·여백으로 비워 두고, 풍경은 오른쪽·아래·양옆에 둡니다.
 *
 * 모든 색은 계절 색에 현재 색상 테마(--primary)를 조금 섞어 칠하므로 테마를 바꾸면 함께 바뀝니다.
 * (color-mix 미지원 브라우저는 계절 색 그대로)
 */

const mixStyle = (hex: string, amt: number, prop: 'fill' | 'stroke'): CSSProperties => ({
  [prop]: `color-mix(in srgb, ${hex} ${amt}%, var(--primary))`,
})
/** 채우기 색 (계절 색 86% + 테마 색 14%) */
const f = (hex: string, amt = 86) => ({ fill: hex, style: mixStyle(hex, amt, 'fill') })
/** 선 색 */
const st = (hex: string, width: number, amt = 86) => ({
  fill: 'none',
  stroke: hex,
  strokeWidth: width,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  style: mixStyle(hex, amt, 'stroke'),
})

function Drift({ n, children }: { n: number; children: ReactNode }) {
  return <g className={`drift d${n}`}>{children}</g>
}

/* ---------------- 봄: 벚꽃 나무 그늘 아래 언덕과 호수 ---------------- */
const SAKURA_PETAL = 'M0,0 C-7,-4 -8,-12 -3.6,-16 L0,-13 L3.6,-16 C8,-12 7,-4 0,0Z'
function Blossom({ x, y, s = 1, color = '#ffffff' }: { x: number; y: number; s?: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <path key={a} d={SAKURA_PETAL} transform={`rotate(${a})`} {...f(color, 94)} />
      ))}
      <circle r={2.6} {...f('#f48fb1', 90)} />
    </g>
  )
}
/** 뭉게뭉게한 꽃 덩어리 (원 여러 개) */
function Canopy({ blobs, color }: { blobs: [number, number, number][]; color: string }) {
  return (
    <g {...f(color)}>
      {blobs.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} />
      ))}
    </g>
  )
}

function Spring() {
  return (
    <>
      <rect width={800} height={200} {...f('#fde4ec', 90)} />
      {/* 먼 언덕·호수 */}
      <path d="M0,132 C90,118 170,124 260,120 C360,116 430,126 520,118 C610,110 700,120 800,114 L800,200 L0,200Z" {...f('#cfe8a6')} />
      <path d="M0,136 C120,130 240,138 400,134 C560,130 680,138 800,132 L800,146 L0,146Z" {...f('#8fd0e6')} />
      {[230, 300, 370, 470, 540, 610].map((x, i) => (
        <path key={i} d={`M${x},${139 + (i % 2) * 3} h${10 + (i % 3) * 4}`} {...st('#ffffff', 1.6, 92)} opacity={0.8} />
      ))}
      {/* 가까운 언덕 */}
      <path d="M0,150 C80,140 160,146 240,142 C330,138 400,150 480,146 C560,142 650,136 800,146 L800,200 L0,200Z" {...f('#9ed27c')} />
      {/* 나무 줄기 */}
      <path d="M548,160 C552,130 550,110 556,84 L570,84 C574,110 572,132 578,160Z" {...f('#a8775a')} />
      <path d="M690,160 C692,136 690,118 696,98 L708,98 C712,118 710,138 714,160Z" {...f('#a8775a')} />
      {/* 꽃 덩어리 (위쪽 가장자리 + 오른쪽 큰 나무) */}
      <Canopy
        color="#f7b9cd"
        blobs={[
          [-10, 0, 60], [70, 10, 44], [140, -10, 60], [250, -26, 56], [350, -30, 52], [450, -14, 54],
          [520, 40, 46], [580, 62, 50], [640, 30, 56], [720, 74, 50], [790, 40, 60], [660, 90, 30],
        ]}
      />
      <Canopy
        color="#fbd0de"
        blobs={[
          [30, 10, 34], [110, 0, 34], [200, -12, 36], [300, -18, 34], [400, -20, 34], [490, 10, 34],
          [560, 44, 32], [620, 14, 36], [700, 52, 34], [770, 14, 40], [600, 80, 26],
        ]}
      />
      {/* 꽃 */}
      <Blossom x={604} y={56} s={1.15} />
      <Blossom x={520} y={30} s={0.8} />
      <Blossom x={690} y={86} s={0.9} color="#f48fb1" />
      <Blossom x={742} y={36} s={1} />
      <Blossom x={150} y={24} s={0.7} color="#f48fb1" />
      {/* 언덕의 들꽃 */}
      {[
        [190, 150, '#ffffff'], [214, 156, '#ffd54f'], [262, 150, '#ff8a65'], [330, 156, '#ffffff'], [410, 152, '#ffd54f'],
        [452, 158, '#ff8a65'], [500, 152, '#ffffff'], [618, 150, '#ffd54f'], [648, 156, '#ffffff'], [740, 152, '#ff8a65'],
      ].map(([x, y, c], i) => (
        <circle key={i} cx={x as number} cy={y as number} r={i % 3 === 2 ? 3.4 : 2.4} {...f(c as string, 94)} />
      ))}
      {/* 흩날리는 꽃잎 */}
      <Drift n={1}><path d={SAKURA_PETAL} transform="translate(430 70) rotate(40) scale(0.8)" {...f('#f48fb1', 92)} /></Drift>
      <Drift n={2}><path d={SAKURA_PETAL} transform="translate(250 96) rotate(-30) scale(0.7)" {...f('#ffffff', 94)} /></Drift>
      <Drift n={3}><path d={SAKURA_PETAL} transform="translate(500 92) rotate(80) scale(0.7)" {...f('#f7b9cd', 92)} /></Drift>
      <Drift n={4}><path d={SAKURA_PETAL} transform="translate(340 60) rotate(-60) scale(0.6)" {...f('#ffffff', 94)} /></Drift>
    </>
  )
}

/* ---------------- 여름: 위에서 내려다본 바다와 모래사장 ---------------- */
function Ring({ x, y, r }: { x: number; y: number; r: number }) {
  const c = 2 * Math.PI * r
  return (
    <g>
      <circle cx={x + 2} cy={y + 3} r={r} {...st('#2a8fb0', 9, 90)} opacity={0.25} />
      <circle cx={x} cy={y} r={r} {...st('#ffffff', 9, 96)} />
      <circle cx={x} cy={y} r={r} {...st('#ef5350', 9, 92)} strokeLinecap="butt" strokeDasharray={`${c / 8} ${c / 8}`} />
    </g>
  )
}
function BeachBall({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r} {...f('#ffffff', 96)} />
      <path d={`M0,${-r} C${r * 0.9},${-r * 0.4} ${r * 0.9},${r * 0.4} 0,${r} C${r * 0.4},${r * 0.4} ${r * 0.4},${-r * 0.4} 0,${-r}Z`} {...f('#ef5350', 92)} />
      <path d={`M0,${-r} C${-r * 0.9},${-r * 0.4} ${-r * 0.9},${r * 0.4} 0,${r} C${-r * 0.4},${r * 0.4} ${-r * 0.4},${-r * 0.4} 0,${-r}Z`} {...f('#ef5350', 92)} />
      <circle r={r * 0.22} {...f('#3949ab', 90)} />
    </g>
  )
}
const STAR = 'M0,-7 L2,-2 L7,-2 L3,1.5 L4.5,7 L0,3.6 L-4.5,7 L-3,1.5 L-7,-2 L-2,-2Z'
function PalmLeaf({ x, y, r, s = 1, color = '#4caf6d' }: { x: number; y: number; r: number; s?: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d="M0,0 C20,-14 60,-16 90,0 C60,8 24,10 0,0Z" {...f(color)} />
      <path d="M4,0 C30,-4 60,-4 86,0" {...st('#e8f5b0', 1.4, 90)} />
    </g>
  )
}

function Summer() {
  return (
    <>
      <rect width={800} height={200} {...f('#5ccbe3', 88)} />
      {/* 물결 무늬 */}
      {[
        'M160,30 C200,20 240,40 280,30 C320,20 360,40 400,30',
        'M200,64 C240,54 280,74 320,64 C360,54 400,74 440,64',
        'M120,100 C160,90 200,110 240,100 C280,90 320,110 360,100',
        'M20,60 C50,52 80,68 110,60',
      ].map((d, i) => (
        <path key={i} d={d} {...st('#9fe6f2', 6, 92)} opacity={0.8} />
      ))}
      {[
        [240, 48, 6, 3], [330, 84, 8, 3.5], [180, 82, 5, 2.5], [420, 46, 7, 3], [290, 116, 6, 3],
      ].map(([x, y, rx, ry], i) => (
        <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} {...f('#c8f3fa', 94)} opacity={0.9} />
      ))}
      {/* 모래사장 + 거품 */}
      <path d="M300,200 C360,170 420,160 470,136 C530,108 580,104 640,80 C700,56 750,40 800,20 L800,200Z" {...f('#f8d9b4', 90)} />
      <path d="M300,200 C360,170 420,160 470,136 C530,108 580,104 640,80 C700,56 750,40 800,20" {...st('#ffffff', 9, 96)} />
      <path d="M286,192 C346,162 406,150 458,126 C518,98 568,94 628,70 C688,46 738,30 790,10" {...st('#d7f6fb', 4, 94)} strokeDasharray="14 10" />
      {/* 튜브·공·불가사리 */}
      <Ring x={470} y={86} r={17} />
      <BeachBall x={610} y={124} r={11} />
      <BeachBall x={140} y={168} r={9} />
      <path d={STAR} transform="translate(540 146) rotate(15)" {...f('#ff7043', 90)} />
      <path d={STAR} transform="translate(700 106) rotate(-20) scale(0.8)" {...f('#ff7043', 90)} />
      <path d="M660,148 c-4,-6 4,-10 8,-6 c4,-4 12,0 8,6Z" {...f('#fff3e0', 94)} />
      {/* 야자잎 (오른쪽 위 모서리, 왼쪽 아래 모서리) */}
      <PalmLeaf x={800} y={-6} r={150} s={1.1} />
      <PalmLeaf x={804} y={40} r={170} s={0.9} color="#7cc96b" />
      <PalmLeaf x={790} y={-20} r={120} s={0.8} color="#2e9f62" />
      <PalmLeaf x={-6} y={200} r={-40} s={1} />
      <PalmLeaf x={-10} y={170} r={-15} s={0.8} color="#7cc96b" />
      <Drift n={1}><circle cx={380} cy={96} r={3} {...f('#ffffff', 96)} opacity={0.8} /></Drift>
      <Drift n={3}><circle cx={250} cy={70} r={2.4} {...f('#ffffff', 96)} opacity={0.8} /></Drift>
    </>
  )
}

/* ---------------- 가을: 크림 배경에 큰 참나무잎·단풍잎·도토리 ---------------- */
const OAK =
  'M0,0 C4,-6 8,-10 12,-8 C14,-14 20,-16 22,-10 C26,-18 32,-19 34,-12 C38,-19 45,-18 46,-11 C51,-14 57,-9 60,0 C57,9 51,14 46,11 C45,18 38,19 34,12 C32,19 26,18 22,10 C20,16 14,14 12,8 C8,10 4,6 0,0Z'
function Oak({ x, y, r, s, color }: { x: number; y: number; r: number; s: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d={OAK} {...f(color)} />
      <path d="M-6,0 L56,0 M14,0 L20,-9 M26,0 L32,-11 M38,0 L44,-10 M14,0 L20,9 M26,0 L32,11 M38,0 L44,10" {...st('#b5452a', 1, 88)} opacity={0.7} />
    </g>
  )
}
const MAPLE =
  'M0,-13 L2.6,-6.5 L6.5,-9 L5.6,-3.4 L12,-4.6 L8.6,0 L11,2.2 L4.6,3.2 L5.8,7.6 L1.2,5.2 L0.8,13 L-0.8,13 L-1.2,5.2 L-5.8,7.6 L-4.6,3.2 L-11,2.2 L-8.6,0 L-12,-4.6 L-5.6,-3.4 L-6.5,-9 L-2.6,-6.5Z'
function MapleLeaf({ x, y, r, s, color }: { x: number; y: number; r: number; s: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d={MAPLE} {...f(color)} />
      <path d="M0,4 L0,-9 M0,4 L8,-2 M0,4 L-8,-2" {...st('#8d2f1e', 0.7, 88)} opacity={0.6} />
    </g>
  )
}
function LongLeaf({ x, y, r, s, color }: { x: number; y: number; r: number; s: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d="M0,0 C20,-22 60,-24 90,0 C60,24 20,22 0,0Z" {...f(color)} />
      <path d="M-8,0 L84,0 M24,0 L36,-12 M44,0 L56,-12 M24,0 L36,12 M44,0 L56,12" {...st('#5e2318', 1.2, 88)} opacity={0.55} />
    </g>
  )
}
function Acorn({ x, y, r = 0, s = 1 }: { x: number; y: number; r?: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d="M-7,0 C-8,10 -3,16 0,16 C3,16 8,10 7,0Z" {...f('#d9893b')} />
      <path d="M-9,1 C-9,-7 9,-7 9,1Z" {...f('#8a4a2b')} />
      <path d="M0,-6 L1,-10" {...st('#5e3220', 1.6, 88)} />
    </g>
  )
}
function Berry({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path d={`M${x},${y} L${x + 6},${y - 10}`} {...st('#4a2b33', 1.2, 90)} />
      <circle cx={x} cy={y} r={4.5} {...f('#c62f3e', 90)} />
    </g>
  )
}

function Autumn() {
  return (
    <>
      <rect width={800} height={200} {...f('#fbe9d2', 92)} />
      {/* 오른쪽 위 큰 잎 (월 이동 아래쪽) */}
      <LongLeaf x={640} y={78} r={-150} s={1.2} color="#b8492f" />
      <LongLeaf x={700} y={24} r={-110} s={1} color="#a63d2c" />
      <Oak x={450} y={128} r={-24} s={1.5} color="#e07a3c" />
      <Oak x={560} y={150} r={-60} s={1.3} color="#f0a23a" />
      <MapleLeaf x={630} y={118} r={20} s={2} color="#d9542f" />
      <MapleLeaf x={740} y={128} r={-25} s={1.7} color="#f0a23a" />
      <Acorn x={520} y={86} r={-15} s={1.1} />
      <Acorn x={690} y={160} r={20} />
      <Berry x={600} y={70} />
      <Berry x={420} y={92} />
      <Berry x={770} y={86} />
      {/* 왼쪽 아래·양옆 (넓은 화면) */}
      <Oak x={30} y={186} r={-30} s={1.3} color="#f0a23a" />
      <MapleLeaf x={150} y={150} r={-15} s={1.6} color="#e07a3c" />
      <LongLeaf x={-30} y={20} r={20} s={0.9} color="#6f79c8" />
      <Oak x={260} y={170} r={-8} s={1} color="#d9542f" />
      <Acorn x={330} y={150} r={-30} s={0.9} />
      <Berry x={210} y={130} />
      {/* 떨어지는 잎 */}
      <Drift n={1}><MapleLeaf x={380} y={56} r={-30} s={0.8} color="#e07a3c" /></Drift>
      <Drift n={2}><MapleLeaf x={300} y={40} r={40} s={0.7} color="#f0a23a" /></Drift>
      <Drift n={3}><MapleLeaf x={480} y={60} r={10} s={0.7} color="#b8492f" /></Drift>
    </>
  )
}

/* ---------------- 겨울: 눈 덮인 산, 전나무, 빨간 집, 눈사람 ---------------- */
function Pine({ x, y, s = 1, color = '#2b3a5c' }: { x: number; y: number; s?: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0,-30 L9,-16 L5,-16 L12,-6 L7,-6 L14,4 L-14,4 L-7,-6 L-12,-6 L-5,-16 L-9,-16Z" {...f(color, 90)} />
      <rect x={-1.6} y={4} width={3.2} height={4} {...f('#5e3a2a', 90)} />
    </g>
  )
}
function Mountain({ x, y, w, h, color }: { x: number; y: number; w: number; h: number; color: string }) {
  const cap = h * 0.3
  return (
    <g>
      <path d={`M${x - w / 2},${y} L${x},${y - h} L${x + w / 2},${y}Z`} {...f(color)} />
      <path
        d={`M${x - (w / 2) * (cap / h)},${y - h + cap} L${x},${y - h} L${x + (w / 2) * (cap / h)},${y - h + cap} L${x + 4},${y - h + cap - 5} L${x - 3},${y - h + cap + 2}Z`}
        {...f('#ffffff', 96)}
      />
    </g>
  )
}
function Snowman({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-10,-14 L-26,-24 M-21,-21 L-25,-28" {...st('#6d4c3d', 2, 90)} />
      <path d="M10,-14 L26,-23 M21,-20 L26,-26" {...st('#6d4c3d', 2, 90)} />
      <circle cx={0} cy={0} r={17} {...f('#ffffff', 96)} stroke="#c9d6ef" strokeWidth={1.2} />
      <circle cx={0} cy={-26} r={12} {...f('#ffffff', 96)} stroke="#c9d6ef" strokeWidth={1.2} />
      <circle cx={0} cy={-6} r={1.6} {...f('#2b2d3a', 96)} />
      <circle cx={0} cy={1} r={1.6} {...f('#2b2d3a', 96)} />
      <path d="M-11,-18 C-4,-14 4,-14 11,-18 L11,-14 C4,-10 -4,-10 -11,-14Z" {...f('#e5483f', 90)} />
      <path d="M5,-14 L9,-2 L4,-2 L2,-13Z" {...f('#e5483f', 90)} />
      <circle cx={-4} cy={-29} r={1.5} {...f('#2b2d3a', 96)} />
      <circle cx={4} cy={-29} r={1.5} {...f('#2b2d3a', 96)} />
      <path d="M0,-26 L11,-24 L0,-22.6Z" {...f('#f08a24', 94)} />
      <rect x={-14} y={-39} width={28} height={3.5} rx={1.5} {...f('#2b2d3a', 94)} />
      <rect x={-9} y={-54} width={18} height={16} rx={2} {...f('#2b2d3a', 94)} />
      <rect x={-9} y={-43} width={18} height={3} {...f('#e5483f', 90)} />
    </g>
  )
}

function Winter() {
  const flakes: [number, number, number][] = [
    [180, 30, 2], [230, 70, 1.6], [300, 20, 2.2], [360, 96, 1.8], [400, 50, 1.6], [440, 20, 2], [470, 80, 2.2],
    [520, 40, 1.6], [600, 20, 2], [650, 60, 1.8], [700, 30, 2.4], [760, 70, 1.8], [40, 50, 2], [100, 20, 1.8],
    [130, 80, 2.2], [280, 120, 1.8], [560, 110, 2], [740, 120, 2.2], [210, 110, 2], [620, 128, 1.6],
  ]
  return (
    <>
      <rect width={800} height={200} {...f('#d3e8f4', 90)} />
      {/* 구름 */}
      <path d="M470,58 c0,-8 10,-10 14,-5 c3,-8 16,-8 18,1 c8,-1 10,8 4,10 h-32 c-6,0 -6,-6 -4,-6Z" {...f('#ffffff', 96)} />
      <path d="M90,30 c0,-7 9,-9 12,-4 c3,-7 14,-7 16,1 c7,-1 9,7 3,9 h-28 c-5,0 -5,-6 -3,-6Z" {...f('#ffffff', 96)} />
      {/* 산 */}
      <Mountain x={560} y={120} w={150} h={80} color="#9cbde0" />
      <Mountain x={660} y={120} w={170} h={96} color="#8aaed6" />
      <Mountain x={760} y={120} w={140} h={70} color="#9cbde0" />
      <Mountain x={70} y={120} w={160} h={84} color="#9cbde0" />
      <path d="M420,124 C460,104 500,100 540,112 L540,130 L420,130Z" {...f('#2f3f63', 88)} />
      {/* 눈 언덕 */}
      <path d="M0,128 C100,112 200,122 300,116 C400,110 470,124 560,116 C650,108 720,118 800,112 L800,200 L0,200Z" {...f('#eaf4fa', 94)} />
      <path d="M0,146 C120,134 220,146 340,138 C460,130 560,142 680,134 C740,130 780,134 800,132 L800,200 L0,200Z" {...f('#ffffff', 96)} />
      <path d="M380,150 C440,142 500,148 560,144" {...st('#b9d6ea', 2, 90)} strokeDasharray="6 5" />
      {/* 전나무 */}
      {[
        [600, 134, 1.1], [622, 138, 0.9], [642, 132, 1.2], [664, 138, 0.85], [740, 132, 1.1], [764, 138, 0.9],
        [180, 150, 0.9], [206, 154, 0.75],
      ].map(([x, y, s], i) => (
        <Pine key={i} x={x} y={y} s={s} color={i % 3 === 1 ? '#3d5583' : '#2b3a5c'} />
      ))}
      {/* 빨간 집 */}
      <g transform="translate(456 132)">
        <rect x={-14} y={-18} width={28} height={20} {...f('#e5483f', 90)} />
        <path d="M-18,-17 C-14,-30 14,-30 18,-17Z" {...f('#2f3f63', 88)} />
        <path d="M-18,-17 C-14,-28 14,-28 18,-17 C10,-20 -10,-20 -18,-17Z" {...f('#ffffff', 96)} />
        {[[-8, -12], [0, -12], [8, -12], [-8, -5], [8, -5]].map(([x, y], i) => (
          <rect key={i} x={x - 2} y={y - 2} width={4} height={4} {...f('#ffffff', 96)} />
        ))}
      </g>
      <Snowman x={540} y={146} />
      {/* 바람 */}
      <path d="M250,128 C270,120 290,134 310,126 C318,122 322,116 316,114" {...st('#3d5583', 1.2, 90)} strokeDasharray="4 4" opacity={0.6} />
      {/* 눈 */}
      {flakes.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} {...f('#ffffff', 98)} />
      ))}
      <Drift n={1}><circle cx={340} cy={50} r={2.4} {...f('#ffffff', 98)} /></Drift>
      <Drift n={2}><circle cx={420} cy={70} r={2} {...f('#ffffff', 98)} /></Drift>
      <Drift n={3}><circle cx={500} cy={30} r={2.6} {...f('#ffffff', 98)} /></Drift>
      <Drift n={4}><circle cx={260} cy={40} r={2} {...f('#ffffff', 98)} /></Drift>
    </>
  )
}

export function SeasonLayer({ season }: { season: Season }) {
  return (
    <svg className={`season season-${season}`} viewBox="0 0 800 200" preserveAspectRatio="xMidYMax slice" aria-hidden focusable="false">
      {season === 'spring' ? <Spring /> : season === 'summer' ? <Summer /> : season === 'autumn' ? <Autumn /> : <Winter />}
    </svg>
  )
}
