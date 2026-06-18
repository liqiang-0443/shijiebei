# World Cup Odds PoC

世界杯竞彩赔率 PoC，包含：

- 前台赔率展示、选择玩法、串关计算和提交
- 后台查看今日提交记录
- Node.js 后端定时抓取公开页面并保存提交数据

## 启动

```bash
npm start
```

默认地址：

- 前台：`http://localhost:4318/`
- 后台：`http://localhost:4318/admin.html`

## 环境变量

- `PORT`：服务端口，默认 `4318`
- `DATA_DIR`：数据目录，默认项目内 `data`

## 部署

见 `DEPLOYMENT.md`。
