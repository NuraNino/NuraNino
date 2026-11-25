import type { ReactNode } from 'react'
import type { Season } from '../theme'

/**
 * 헤더 뒤 계절 장식 (400×200, 오른쪽 위 고정).
 * 색은 모두 CSS 변수(--primary, --hero-ink, 계절 색)로 정해지므로
 * 색상 테마·라이트/다크를 바꾸면 함께 바뀝니다.
 * 헤더에서 장식이 보이는 영역: 월 이동 버튼 아래(y≈46)부터 카드가 겹치기 전(y≈112)까지.
 */

/** 끝이 살짝 갈라진 벚꽃잎 (중심에서 위로 길이 16) */
const SAKURA_PETAL = 'M0,0 C-7,-4 -8,-12 -3.6,-16 L0,-13 L3.6,-16 C8,-12 7,-4 0,0Z'
const Petal = () => <path d={SAKURA_PETAL} />
const Blossom = () => (
  <g>
    {[0, 72, 144, 216, 288].map((a) => (
      <path key={a} d={SAKURA_PETAL} transform={`rotate(${a})`} />
    ))}
    <circle r={3.2} className="s-core" />
    {[0, 60, 120, 180, 240, 300].map((a) => (
      <circle key={a} r={0.9} cx={Math.cos((a * Math.PI) / 180) * 5} cy={Math.sin((a * Math.PI) / 180) * 5} className="s-core" />
    ))}
  </g>
)

/** 손바닥 모양 단풍잎(메이플), 대략 24×26 */
const MAPLE =
  'M0,-13 L2.6,-6.5 L6.5,-9 L5.6,-3.4 L12,-4.6 L8.6,0 L11,2.2 L4.6,3.2 L5.8,7.6 L1.2,5.2 L0.8,13 L-0.8,13 L-1.2,5.2 L-5.8,7.6 L-4.6,3.2 L-11,2.2 L-8.6,0 L-12,-4.6 L-5.6,-3.4 L-6.5,-9 L-2.6,-6.5Z'
const Maple = () => (
  <g>
    <path d={MAPLE} className="s-maple" />
    <path d="M0,4 L0,-9 M0,4 L8,-2 M0,4 L-8,-2 M0,4 L3.6,6.6 M0,4 L-3.6,6.6" className="s-vein" />
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
      <path className="s-branch" d="M412,52 C372,62 332,72 296,90 C272,102 250,108 228,112" />
      <path className="s-branch thin" d="M334,70 C326,58 314,52 300,50" />
      <path className="s-branch thin" d="M270,100 C262,92 254,88 244,86" />
      <Place x={300} y={88} r={10} cls="s-a" s={1.15}><Blossom /></Place>
      <Place x={364} y={64} r={-15} cls="s-a" s={1.35}><Blossom /></Place>
      <Place x={302} y={52} r={30} cls="s-b" s={0.85}><Blossom /></Place>
      <Place x={246} y={88} r={-25} cls="s-b" s={0.9}><Blossom /></Place>
      <Place x={392} y={98} r={20} cls="s-b" s={0.8}><Blossom /></Place>
      <Place x={200} y={64} r={40} cls="s-a" s={1.1} drift={1}><Petal /></Place>
      <Place x={150} y={34} r={-25} cls="s-b" s={1} drift={2}><Petal /></Place>
      <Place x={236} y={58} r={70} cls="s-a" s={0.95} drift={3}><Petal /></Place>
      <Place x={110} y={110} r={-55} cls="s-b" s={1} drift={4}><Petal /></Place>
    </>
  )
}

function Summer() {
  return (
    <>
      {/* 해 (수평선 위) */}
      <circle cx={232} cy={86} r={25} className="s-c s-halo" />
      <circle cx={232} cy={86} r={17} className="s-sun" />
      {/* 바다 */}
      <path className="s-sea" d="M150,96 C200,92 260,93 300,95 C340,97 380,94 420,95 L420,200 L150,200Z" />
      <path className="s-wave" d="M176,104 C188,100 200,108 212,104 C224,100 236,108 248,104" />
      <path className="s-wave" d="M262,112 C274,108 286,116 298,112 C310,108 322,116 334,112" />
      <path className="s-wave thin" d="M200,120 C212,116 224,124 236,120 C248,116 260,124 272,120" />
      {/* 야자수 */}
      <path className="s-trunk" d="M322,126 C318,108 318,92 324,80 C328,74 332,72 336,70" />
      <g transform="translate(336 70) scale(0.95)" className="s-frond">
        <path d="M0,0 C-14,-12 -32,-10 -42,2 C-30,-4 -14,-2 0,0Z" />
        <path d="M0,0 C-8,-18 -22,-26 -36,-22 C-22,-18 -10,-10 0,0Z" />
        <path d="M0,0 C6,-16 18,-24 32,-22 C18,-16 8,-8 0,0Z" />
        <path d="M0,0 C14,-10 30,-8 40,4 C28,-2 14,-1 0,0Z" />
        <path d="M0,0 C6,10 8,22 4,32 C2,22 -1,10 0,0Z" />
        <path d="M0,0 C-10,8 -16,20 -14,30 C-10,20 -5,10 0,0Z" />
      </g>
      <circle cx={333} cy={74} r={3} className="s-nut" />
      <circle cx={340} cy={75} r={3} className="s-nut" />
      <Place x={190} y={66} cls="s-b" drift={1}><circle r={2.5} /></Place>
      <Place x={276} y={66} cls="s-c" drift={3}><circle r={2} /></Place>
    </>
  )
}

function Autumn() {
  return (
    <>
      <Place x={340} y={78} r={-20} cls="s-a" s={1.6}><Maple /></Place>
      <Place x={384} y={100} r={35} cls="s-b" s={1.25}><Maple /></Place>
      <Place x={292} y={98} r={12} cls="s-c" s={1.15}><Maple /></Place>
      <Place x={380} y={58} r={-55} cls="s-c" s={0.9}><Maple /></Place>
      <Place x={200} y={60} r={-40} cls="s-b" s={0.85} drift={1}><Maple /></Place>
      <Place x={150} y={32} r={25} cls="s-a" s={0.8} drift={2}><Maple /></Place>
      <Place x={244} y={80} r={-15} cls="s-c" s={0.8} drift={3}><Maple /></Place>
      <Place x={110} y={116} r={60} cls="s-a" s={0.75} drift={4}><Maple /></Place>
    </>
  )
}

function Snowman() {
  return (
    <g transform="translate(340 0)">
      {/* 팔 */}
      <path className="s-arm" d="M-10,86 L-26,76 M-21,79 L-25,72" />
      <path className="s-arm" d="M10,86 L26,77 M21,80 L26,74" />
      {/* 몸 */}
      <circle cx={0} cy={100} r={17} className="s-snow" />
      <circle cx={0} cy={74} r={12} className="s-snow" />
      {/* 단추 */}
      <circle cx={0} cy={94} r={1.6} className="s-coal" />
      <circle cx={0} cy={101} r={1.6} className="s-coal" />
      {/* 목도리 */}
      <path className="s-scarf" d="M-11,82 C-4,86 4,86 11,82 L11,86 C4,90 -4,90 -11,86Z" />
      <path className="s-scarf" d="M5,86 L9,98 L4,98 L2,87Z" />
      {/* 얼굴 */}
      <circle cx={-4} cy={71} r={1.5} className="s-coal" />
      <circle cx={4} cy={71} r={1.5} className="s-coal" />
      <path className="s-carrot" d="M0,74 L11,76 L0,77.4Z" />
      {/* 모자 */}
      <rect x={-14} y={61} width={28} height={3.5} rx={1.5} className="s-hat" />
      <rect x={-9} y={46} width={18} height={16} rx={2} className="s-hat" />
      <rect x={-9} y={57} width={18} height={3} className="s-hatband" />
    </g>
  )
}

function Winter() {
  return (
    <>
      {/* 눈밭 */}
      <path className="s-field" d="M120,128 C180,108 240,118 300,108 C340,101 380,106 420,100 L420,200 L120,200Z" />
      <Snowman />
      <Place x={262} y={70} cls="s-ink" s={1.2}><Flake /></Place>
      <Place x={392} y={60} cls="s-b" s={0.8}><Flake /></Place>
      <Place x={200} y={58} cls="s-ink" s={0.65} drift={1}><Flake /></Place>
      <Place x={150} y={30} cls="s-b" s={0.6} drift={2}><Flake /></Place>
      <Place x={232} y={92} cls="s-ink" s={0.5} drift={3}><Flake /></Place>
      <Place x={110} y={112} cls="s-b" s={0.55} drift={4}><Flake /></Place>
      {[
        [226, 108], [290, 52], [196, 96], [306, 84], [384, 84], [176, 124],
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
