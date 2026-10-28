// 提交信息按约定式提交检查：必须是「类型: 说明」，类型用 feat、fix、docs、refactor、test、chore、ci 等。
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 中文正文不按 100 个字符折行，关掉行宽限制，免得一句长一点的说明就被拒绝
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
}
