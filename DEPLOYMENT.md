# 部署说明

## 当前推荐

先按单 Node 服务部署，前台、后台、接口都由 `server.js` 提供。

访问地址：

- 前台：`http://host:4318/`
- 后台：`http://host:4318/admin.html`
- 提交接口：`POST /api/submissions`
- 后台数据接口：`GET /api/submissions`

## 本机启动

```powershell
npm start
```

也可以直接：

```powershell
node server.js
```

## 服务器启动

```bash
PORT=4318 DATA_DIR=/data/worldcup-odds npm start
```

`DATA_DIR` 一定要放到持久化目录，否则重启容器或重新发布时提交记录可能丢失。

## PM2 示例

```bash
pm2 start server.js --name worldcup-odds --env production
pm2 save
```

如果要指定目录：

```bash
PORT=4318 DATA_DIR=/data/worldcup-odds pm2 start server.js --name worldcup-odds
```

## VPS Docker 部署

一键部署，适合砖瓦工 Ubuntu/Debian/CentOS VPS：

```bash
curl -fsSL https://raw.githubusercontent.com/liqiang-0443/shijiebei/main/scripts/deploy-vps.sh | bash
```

如果不是 root 用户：

```bash
curl -fsSL https://raw.githubusercontent.com/liqiang-0443/shijiebei/main/scripts/deploy-vps.sh | sudo bash
```

自定义端口：

```bash
curl -fsSL https://raw.githubusercontent.com/liqiang-0443/shijiebei/main/scripts/deploy-vps.sh | env PORT=8080 bash
```

在 VPS 上安装 Docker 后执行：

```bash
git clone <你的GitHub仓库地址> worldcup-odds-poc
cd worldcup-odds-poc
mkdir -p /data/worldcup-odds
docker build -t worldcup-odds-poc .
docker run -d \
  --name worldcup-odds-poc \
  --restart unless-stopped \
  -p 4318:4318 \
  -e PORT=4318 \
  -e DATA_DIR=/data \
  -v /data/worldcup-odds:/data \
  worldcup-odds-poc
```

更新代码：

```bash
cd worldcup-odds-poc
git pull
docker build -t worldcup-odds-poc .
docker rm -f worldcup-odds-poc
docker run -d \
  --name worldcup-odds-poc \
  --restart unless-stopped \
  -p 4318:4318 \
  -e PORT=4318 \
  -e DATA_DIR=/data \
  -v /data/worldcup-odds:/data \
  worldcup-odds-poc
```

访问：

- 前台：`http://你的VPS-IP:4318/`
- 后台：`http://你的VPS-IP:4318/admin.html`

## VPS 不用 Docker

安装 Node.js 20+ 后：

```bash
git clone <你的GitHub仓库地址> /opt/worldcup-odds-poc
cd /opt/worldcup-odds-poc
mkdir -p /data/worldcup-odds
PORT=4318 DATA_DIR=/data/worldcup-odds npm start
```

长期运行建议用 systemd：

```bash
sudo tee /etc/systemd/system/worldcup-odds.service >/dev/null <<'EOF'
[Unit]
Description=World Cup Odds PoC
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/worldcup-odds-poc
Environment=PORT=4318
Environment=DATA_DIR=/data/worldcup-odds
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now worldcup-odds
sudo systemctl status worldcup-odds
```

## 反向代理

建议用 Nginx / Caddy 代理到 `127.0.0.1:4318`，再挂 HTTPS。

后台目前是 POC 级别，没有登录鉴权。正式对外前建议至少加：

- 内网访问或 VPN
- Basic Auth
- 或后台 token 登录

## 数据文件

默认数据在项目内：

- `data/history.json`
- `data/submissions.json`

生产环境建议用 `DATA_DIR` 指到独立持久化目录。
