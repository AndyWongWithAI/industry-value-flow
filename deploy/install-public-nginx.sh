#!/bin/bash
# install-public-nginx.sh — 在 #1 上配置 industry.intelab.cn 公网 HTTPS 入口
# 复用 arch-platform/deploy/install-public-nginx.sh 模式(2026-06-20 验证)
#
# 流程:
#   1. 验证 DNS 已生效
#   2. 准备 webroot
#   3. 复制 nginx 配置 + dummy SSL 占位
#   4. certbot certonly --webroot 申请 SSL
#   5. 把 nginx 切回真实证书 + reload
#   6. 验证公网访问
#
# 用法:sudo bash /opt/services/industry-value-flow/deploy/install-public-nginx.sh [email]

set -e

DOMAIN="${DOMAIN:-industry.intelab.cn}"
EMAIL="${1:-${ADMIN_EMAIL:-admin@intelab.cn}}"
CONF_SRC="$(dirname "$0")/nginx-industry-intelab.conf"
CONF_DST="/etc/nginx/sites-available/$DOMAIN"
LINK_DST="/etc/nginx/sites-enabled/$DOMAIN"

echo "[install-public-nginx] 域名: $DOMAIN"
echo "[install-public-nginx] 邮箱: $EMAIL"

if [ -z "$EMAIL" ]; then
    echo "ERROR: 请提供邮箱(Let's Encrypt 注册用)" >&2
    echo "用法: $0 your-email@example.com" >&2
    exit 1
fi

echo ""
echo "[Step 1/6] 验证 DNS..."
RESOLVED=$(dig +short "$DOMAIN" 2>/dev/null | head -1)
EXPECTED="124.71.219.208"
if [ "$RESOLVED" != "$EXPECTED" ]; then
    echo "ERROR: DNS 未生效或解析错误" >&2
    echo "  实际解析: $RESOLVED" >&2
    echo "  期望解析: $EXPECTED" >&2
    echo "  请先在域名服务商加 A 记录:$DOMAIN → $EXPECTED" >&2
    exit 1
fi
echo "  ✓ DNS 解析正确: $DOMAIN → $RESOLVED"

echo ""
echo "[Step 2/6] 准备 webroot 目录..."
WEBROOT="/var/www/letsencrypt"
mkdir -p "$WEBROOT"
echo "  ✓ $WEBROOT"

echo ""
echo "[Step 3/6] 复制 nginx 配置 + dummy SSL..."
cp "$CONF_SRC" "$CONF_DST"
chmod 644 "$CONF_DST"

DUMMY_DIR="/etc/nginx/ssl-dummy"
mkdir -p "$DUMMY_DIR"
openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
    -keyout "$DUMMY_DIR/dummy.key" \
    -out "$DUMMY_DIR/dummy.crt" \
    -subj "/CN=$DOMAIN" 2>/dev/null

sed -i \
    -e "s|# ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;|ssl_certificate $DUMMY_DIR/dummy.crt;|" \
    -e "s|# ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;|ssl_certificate_key $DUMMY_DIR/dummy.key;|" \
    "$CONF_DST"

if [ ! -f "$LINK_DST" ]; then
    ln -sf "$CONF_DST" "$LINK_DST"
fi
nginx -t
nginx -s reload || systemctl reload nginx
echo "  ✓ nginx 已重载(80 + 443 临时 SSL)"

echo ""
echo "[Step 4/6] 申请 SSL 证书(certbot certonly --webroot)..."
certbot certonly \
    --webroot \
    -w "$WEBROOT" \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    -d "$DOMAIN"
CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
if [ ! -f "$CERT_PATH" ]; then
    echo "ERROR: SSL 证书申请失败,$CERT_PATH 不存在" >&2
    exit 1
fi
echo "  ✓ 证书已签发:$CERT_PATH"

echo ""
echo "[Step 5/6] 把 nginx 切回真实 SSL 证书 + 重载..."
sed -i \
    -e "s|ssl_certificate $DUMMY_DIR/dummy.crt;|ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;|" \
    -e "s|ssl_certificate_key $DUMMY_DIR/dummy.key;|ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;|" \
    -e 's|^    # include /etc/letsencrypt/options-ssl-nginx.conf;|    include /etc/letsencrypt/options-ssl-nginx.conf;|' \
    -e 's|^    # ssl_dhparam |    ssl_dhparam |' \
    "$CONF_DST"
nginx -t
nginx -s reload || systemctl reload nginx
echo "  ✓ nginx HTTPS 已切到真实证书"

echo ""
echo "[Step 6/6] 验证公网访问..."
sleep 3
HTTP_CODE=$(curl -sk -o /tmp/industry-health.txt -w "%{http_code}" "https://$DOMAIN/api/settings/llm")
HEALTH=$(cat /tmp/industry-health.txt)
echo "  HTTP=$HTTP_CODE"
echo "  BODY=$HEALTH"
if [ "$HTTP_CODE" = "200" ]; then
    echo ""
    echo "[install-public-nginx] ✅ 完成!"
    echo "  公网 URL:https://$DOMAIN"
else
    echo "WARN: 公网访问异常(可能因为 docker compose 还没起 backend,先启动再回来验)" >&2
    echo "  公网 URL:https://$DOMAIN(等 docker compose up 后再测)" >&2
fi
