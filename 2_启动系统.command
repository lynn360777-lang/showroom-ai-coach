#!/bin/bash
cd "$(dirname "$0")"
clear
if ! command -v node >/dev/null 2>&1; then
 echo "未检测到 Node.js，请先安装 Node.js LTS。"
 echo "https://nodejs.org/"
 read -p "按回车关闭..."
 exit 1
fi
if [ ! -f .env ]; then
 echo "请先双击 1_配置Azure.command。"
 read -p "按回车关闭..."
 exit 1
fi
if [ ! -d node_modules ]; then
 echo "首次运行，正在安装依赖..."
 npm install || { echo "安装失败"; read -p "按回车关闭..."; exit 1; }
fi
(open "http://localhost:3000" >/dev/null 2>&1 &) 
npm start
