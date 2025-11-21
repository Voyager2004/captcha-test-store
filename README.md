<div align="center">

# 🤖Human-Or-Not

一个令人抓狂的网站

[![GitHub](https://img.shields.io/badge/GitHub-Voyager2004-black?logo=github)](https://github.com/Voyager2004)

</div>

用于在个人服务器部署的模拟购物网站，专门为爬虫/自动化 Agent 的验证码通过能力测试而设计。站点提供常见的内置验证码类型与弹窗提示，并在每次打开页面时强制弹出、随机轮换，以最大化覆盖不同处理逻辑。站点同时采集行为日志与可疑特征用于分析与改进。

## 功能特性
- 页面结构：首页、商品列表、商品详情、购物车、结算、登录、注册
- 强制验证码与弹窗：每次打开新页面都会弹窗并跳转到验证码页，通过后仅本次回跳放行
- 随机轮换且不重复：每次弹出与上一次类型不同
- 内置验证码类型：
  - 文本字符（`text`）：识别 SVG 文本
  - 数学表达式（`math`）：计算表达式结果
  - 网格选择（`grid`）：3×3 格子，选择包含目标符号的所有格子
  - 滑块（`slider`）：拖动到目标值附近（±3），带刻度与当前值显示
  - 选择题（`qa`）：从问题池随机抽题并选择正确答案
- 行为日志：采集请求头异常、前端交互事件（点击、滚动、鼠标、键盘等）及浏览器指纹特征

## 快速开始
- 安装依赖：
  - `npm install`
- 启动服务：
  - `npm start`
- 访问站点：
  - `http://localhost:3000/`
- 查看日志：
  - `http://localhost:3000/admin/logs`

## 环境变量
- `PORT`：服务端口，默认 `3000`
- `SESSION_SECRET`：会话密钥（建议填写随机字符串）



## 路由说明
- `GET /` 首页
- `GET /products` 商品列表
- `GET /product/:id` 商品详情
- `GET /cart` 购物车
- `GET /checkout` 结算
- `GET /login` 登录
- `GET /register` 注册
- `GET /captcha` 验证码页（内部跳转使用）
- `POST /captcha/verify` 验证码校验
- `POST /log` 前端行为事件上报
- `GET /admin/logs` 最近 200 条日志查看（JSON 行）

## 验证码类型强制测试
- 直接访问验证码页并指定类型进行测试：
  - 例：`/captcha?target=/products&type=text`
  - 可用类型：`text`、`math`、`grid`、`slider`、`qa`

## 日志与分析
- 文件位置：`logs/activity.log`（按行写入 JSON）
- 服务端记录：请求路径、方法、UA、IP、Referer、可疑特征（如缺失 UA、`navigator.webdriver` 等）
- 前端事件：`public/js/logger.js` 采集 `page_load`、`click`、`mousemove`、`scroll`、`keydown`、`visibility` 等并批量上报

## 自定义与扩展
- 轮换池：在 `server.js` 的 `pickCaptchaType` 中调整 `available` 列表即可增减类型
- 新类型建议：图片点选、顺序选择、拼图滑块、方向判断等（可按同样方式在模板与校验端点中扩展）
- 风险策略：可在拦截中根据行为评分选择更强类型或多重挑战

## 部署建议
- 生产环境请设置 `SESSION_SECRET` 并使用反向代理（如 Nginx）启用 HTTPS
- 日志滚动与归档：建议配合外部日志系统或定期清理 `logs/activity.log`

## 许可证
- 本项目用于验证与研究目的，请勿用于绕过第三方服务的安全机制
