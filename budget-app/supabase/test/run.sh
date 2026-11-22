#!/usr/bin/env bash
# 로컬 PostgreSQL로 schema.sql 과 접근 규칙을 테스트합니다.
# 사용: PGDATABASE=budget_test supabase/test/run.sh  (빈 테스트용 DB에서 실행)
set -euo pipefail
cd "$(dirname "$0")"
psql -v ON_ERROR_STOP=1 -q -f supabase_mock.sql
psql -v ON_ERROR_STOP=1 -q -f ../schema.sql
psql -v ON_ERROR_STOP=1 -q -f ../schema.sql   # 두 번 실행해도 안전한지
psql -v ON_ERROR_STOP=1 -q -f rls_test.sql
