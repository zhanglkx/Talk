// 普通 API 测试一律用这个地址：127.0.0.1:1 上没有服务，连接会被立即拒绝（ECONNREFUSED）。
// 用 = 而不是 ??=：终端里导出的 DATABASE_URL 也会被覆盖，测试漏了拦截只会连接失败，不会连上真实数据库。
// @nestjs/config 默认以进程环境变量优先，仓库根 .env 里的连接串同样不会生效。
// 真实数据库测试不能加载这个文件，否则地址会被改回这里。
process.env.DATABASE_URL = 'postgresql://127.0.0.1:1/ledger_unit_offline'
