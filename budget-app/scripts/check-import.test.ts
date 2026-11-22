// 실제 엑셀 파일로 가져오기 결과를 확인하는 개발용 스크립트 (vitest로 실행)
// 사용: XLSX=/path/to/file.xlsx npx vitest run scripts/check-import.test.ts
import { test } from 'vitest'
import readXlsxFile, { readSheetNames } from 'read-excel-file/node'
import { parseWorkbook, applyImport, type Workbook } from '../src/domain/importExcel'
import { createDefaultData } from '../src/domain/defaults'
import { monthSummary, won } from '../src/domain/calc'

test.skipIf(!process.env.XLSX)('import real workbook', async () => {
  const file = process.env.XLSX!
  const wb: Workbook = {}
  for (const name of await readSheetNames(file)) wb[name] = (await readXlsxFile(file, { sheet: name })) as Workbook[string]
  const parsed = parseWorkbook(wb)
  const { data, stats } = applyImport(createDefaultData(), parsed, { replaceMonth: true })
  console.log(stats)
  const s = monthSummary(data, stats.month!)
  console.log({ ...s, groups: undefined })
  for (const g of s.groups) console.log(g.group, won(g.planned), won(g.actual), g.categories.map((c) => `${c.category.name}:${c.planned}/${c.actual}`).join(' '))
})
