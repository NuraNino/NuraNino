import type { ReactNode } from 'react'
import type { Season } from '../theme'

/**
 * 헤더 뒤 계절 장식. 색은 모두 CSS 변수(--primary, --hero-ink, 계절 색)로 정해지므로
 * 색상 테마·라이트/다크를 바꾸면 함께 바뀝니다.
 */

const Petal = () => <path d="M0,-9 C6,-6 6,4 0,9 C-6,4 -6,-6 0,-9Z" />
const Blossom = ({ r = 5 }: { r?: number }) => (
  <g>
    {[0, 72, 144, 216, 288].map((a) => (
      <ellipse key={a} cx={0} cy={-r} rx={r * 0.62} ry={r} transform={`rotate(${a})`} />
    ))}
    <circle r={r * 0.4} className="s-core" />
  </g>
)
const Leaf = () => (
  <g>
    <path d="M0,-12 C9,-7 9,6 0,12 C-9,6 -9,-7 0,-12Z" />
    <path d="M0,-10 L0,14" className="s-vein" />
  </g>
)
const Flake = ({ r = 7 }: { r?: number }) => (
  <g className="s-flake">
    {[0, 60, 120].map((a) => (
      <g key={a} transform={`rotate(${a})`}>
        <line x1={0} y1={-r} x2={0} y2={r} />
        <line x1={0} y1={-r * 0.6} x2={-r * 0.3} y2={-r * 0.85} />
        <line x1={0} y1={-r * 0.6} x2={r * 0.3} y2={-r * 0.85} />
        <line x1={0} y1={r * 0.6} x2={-r * 0.3} y2={r * 0.85} />
        <line x1={0} y1={r * 0.6} x2={r * 0.3} y2={r * 0.85} />
      </g>
    ))}
  </g>
)

/** 정적인 위치(x, y, 회전, 크기)에 놓되, drift면 천천히 흔들리며 떨어지는 애니메이션 */
function Place({ x, y, r = 0, s = 1, cls, drift, children }: { x: number; y: number; r?: number; s?: number; cls: string; drift?: number; children: ReactNode }) {
  const inner = (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`} className={cls}>
      {children}
    </g>
  )
  return drift ? <g className={`drift d${drift}`}>{inner}</g> : inner
}

function Spring() {
  return (
    <>
      <path className="s-branch" d="M410,58 C370,66 330,74 296,90 C272,101 254,106 236,110" />
      <path className="s-branch thin" d="M330,74 C322,62 310,56 298,54" />
      <Place x={296} y={90} cls="s-a" s={1.1}><Blossom /></Place>
      <Place x={330} y={74} cls="s-b"><Blossom r={4} /></Place>
      <Place x={364} y={66} cls="s-a" s={1.3}><Blossom /></Place>
      <Place x={252} y={106} cls="s-b" s={0.9}><Blossom /></Place>
      <Place x={300} y={56} cls="s-a" s={0.8}><Blossom r={4} /></Place>
      <Place x={386} y={92} cls="s-b" s={0.9}><Blossom r={4} /></Place>
      <Place x={200} y={60} r={30} cls="s-a" s={0.6} drift={1}><Petal /></Place>
      <Place x={150} y={30} r={-20} cls="s-b" s={0.55} drift={2}><Petal /></Place>
      <Place x={232} y={84} r={60} cls="s-a" s={0.5} drift={3}><Petal /></Place>
      <Place x={110} y={120} r={-50} cls="s-b" s={0.55} drift={4}><Petal /></Place>
    </>
  )
}

function Summer() {
  return (
    <>
      <g className="s-rays">
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} x1={350 + Math.cos((i * Math.PI) / 6) * 34} y1={92 + Math.sin((i * Math.PI) / 6) * 34} x2={350 + Math.cos((i * Math.PI) / 6) * 46} y2={92 + Math.sin((i * Math.PI) / 6) * 46} />
        ))}
      </g>
      <circle cx={350} cy={92} r={27} className="s-a" />
      <circle cx={350} cy={92} r={19} className="s-c" />
      <path className="s-wave" d="M180,128 C210,118 240,138 270,128 C300,118 330,138 360,128 C380,121 395,130 420,126" />
      <path className="s-wave thin" d="M210,140 C240,130 270,150 300,140 C330,130 360,150 390,140 C400,137 410,138 420,138" />
      <Place x={220} y={70} cls="s-b" drift={1}><circle r={3} /></Place>
      <Place x={270} y={100} cls="s-a" drift={3}><circle r={2.5} /></Place>
      <Place x={190} y={110} cls="s-b" drift={2}><circle r={2} /></Place>
    </>
  )
}

function Autumn() {
  return (
    <>
      <Place x={338} y={78} r={-30} cls="s-a" s={1.5}><Leaf /></Place>
      <Place x={378} y={98} r={40} cls="s-b" s={1.15}><Leaf /></Place>
      <Place x={298} y={100} r={15} cls="s-c" s={1.05}><Leaf /></Place>
      <Place x={372} y={58} r={-70} cls="s-c" s={0.8}><Leaf /></Place>
      <Place x={200} y={56} r={-60} cls="s-b" s={0.7} drift={1}><Leaf /></Place>
      <Place x={150} y={30} r={30} cls="s-a" s={0.6} drift={2}><Leaf /></Place>
      <Place x={246} y={86} r={-20} cls="s-c" s={0.65} drift={3}><Leaf /></Place>
      <Place x={110} y={118} r={70} cls="s-a" s={0.6} drift={4}><Leaf /></Place>
    </>
  )
}

function Winter() {
  return (
    <>
      <path className="s-drift" d="M-10,150 C60,124 120,140 190,128 C260,116 320,138 400,124 L400,220 L-10,220Z" />
      <Place x={344} y={84} cls="s-ink" s={1.5}><Flake /></Place>
      <Place x={296} y={104} cls="s-b" s={0.95}><Flake /></Place>
      <Place x={384} y={62} cls="s-ink" s={0.75}><Flake /></Place>
      <Place x={200} y={58} cls="s-ink" s={0.6} drift={1}><Flake /></Place>
      <Place x={150} y={30} cls="s-b" s={0.55} drift={2}><Flake /></Place>
      <Place x={250} y={80} cls="s-ink" s={0.5} drift={3}><Flake /></Place>
      <Place x={110} y={118} cls="s-b" s={0.5} drift={4}><Flake /></Place>
      {[
        [230, 110], [270, 64], [196, 96], [320, 60], [180, 128], [40, 140], [390, 110],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 2 ? 1.6 : 2.4} className="s-dot" />
      ))}
    </>
  )
}

export function SeasonLayer({ season }: { season: Season }) {
  return (
    <svg className={`season season-${season}`} viewBox="0 0 400 200" preserveAspectRatio="xMaxYMin meet" aria-hidden focusable="false">
      {season === 'spring' ? <Spring /> : season === 'summer' ? <Summer /> : season === 'autumn' ? <Autumn /> : <Winter />}
    </svg>
  )
}
