#!/bin/bash
cd "$(dirname "$0")"
clear
echo "Showroom AI Coach V6 PRO - Azure Speech 配置"
echo ""
read -p "请输入 AZURE_SPEECH_KEY: " KEY
read -p "请输入 AZURE_SPEECH_REGION（例如 southeastasia / eastus）: " REGION
cat > .env <<EOF
AZURE_SPEECH_KEY=$KEY
AZURE_SPEECH_REGION=$REGION
PORT=3000
EOF
chmod 600 .env
echo ""
echo "已保存。以后无需重复配置。"
read -p "按回车关闭..."
