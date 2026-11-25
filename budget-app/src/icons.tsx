import {
  Banknote,
  BookOpen,
  Building2,
  Car,
  Church,
  Coffee,
  Ellipsis,
  Gift,
  HandHeart,
  Landmark,
  Mail,
  Palmtree,
  Percent,
  PiggyBank,
  Pill,
  Plane,
  Repeat,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Tag,
  Users,
  UtensilsCrossed,
  Wallet,
  Wifi,
  type LucideIcon,
} from 'lucide-react'
import type { Category, Group } from './domain/types'

/** 작은 항목 이름 → 아이콘 (이름에 포함된 단어로 찾음, 없으면 큰 항목 기본 아이콘) */
const BY_NAME: [RegExp, LucideIcon][] = [
  [/집밥|장보|식료/, ShoppingCart],
  [/외식|식당/, UtensilsCrossed],
  [/커피|카페/, Coffee],
  [/생활용품|쇼핑/, ShoppingBag],
  [/의류|미용|옷/, Shirt],
  [/병원|의료|약/, Pill],
  [/자동차|주유|주차|교통/, Car],
  [/휴식|여가/, Palmtree],
  [/취미|계발|도서|교육/, BookOpen],
  [/용돈/, Wallet],
  [/헌금|십일조/, Church],
  [/보험/, ShieldCheck],
  [/이자|대출/, Percent],
  [/관리비|주거|월세/, Building2],
  [/통신|인터넷|휴대폰/, Wifi],
  [/구독/, Repeat],
  [/후원/, HandHeart],
  [/선물/, Gift],
  [/경조사/, Mail],
  [/친목|모임/, Users],
  [/여행/, Plane],
  [/적금/, PiggyBank],
  [/예금|저축/, Landmark],
  [/기타/, Ellipsis],
]

const BY_GROUP: Record<Group, LucideIcon> = {
  생활비: ShoppingBag,
  고정비: Banknote,
  예비비: Gift,
  저축: PiggyBank,
}

export const GROUP_CLASS: Record<Group, string> = {
  생활비: 'g-living',
  고정비: 'g-fixed',
  예비비: 'g-reserve',
  저축: 'g-saving',
}

export function iconFor(c: Pick<Category, 'name' | 'group'> | undefined): LucideIcon {
  if (!c) return Tag
  return BY_NAME.find(([re]) => re.test(c.name))?.[1] ?? BY_GROUP[c.group] ?? Tag
}

/** 분류 아이콘 타일 (큰 항목 색) */
export function CategoryBadge({ category, size = 40 }: { category?: Pick<Category, 'name' | 'group'>; size?: number }) {
  const Icon = iconFor(category)
  return (
    <span className={`cat-badge ${category ? GROUP_CLASS[category.group] : ''}`} style={{ width: size, height: size }} aria-hidden>
      <Icon size={Math.round(size * 0.5)} strokeWidth={2} />
    </span>
  )
}

export function GroupIcon({ group, size = 20 }: { group: Group; size?: number }) {
  const Icon = BY_GROUP[group]
  return <Icon size={size} strokeWidth={2} aria-hidden />
}
