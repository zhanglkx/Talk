// 提交前只处理这次暂存的文件：格式问题由 Prettier 直接改好并重新暂存。
// oxlint 对整个应用跑一遍而不是只查改动的文件：API 的类型感知规则需要完整的 TypeScript 项目，
// 而且 oxlint 很快（两端加起来约 1 秒），不会拖慢提交。
export default {
  '*.{js,jsx,mjs,cjs,ts,tsx,json,css,html,yml,yaml}': 'prettier --write',
  'apps/api/**/*.ts': () => 'pnpm --filter @xinghe/api run lint',
  'apps/web/**/*.{ts,tsx}': () => 'pnpm --filter @xinghe/web run lint',
}
