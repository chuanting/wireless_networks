# 现代通信网络 · Modern Communication Networks

课程讲义站点（纯静态，托管在 GitHub Pages）。打开主页 → 点击一章 → 点击小节 → 直接在浏览器里放映课件。

**在线地址**：<https://chuanting.github.io/wireless_networks/>

## 课程结构

| 章 | 题目 | 课件 |
|---|---|---|
| 1 | 通信网络概论及数学基础 | 1.2 数学基础：随机过程（38 页）、1.3 数学基础：图论（48 页）已发布；1.1 待补充 |
| 2 | 端到端的传输协议 | 2.1 组帧技术（51 页）、2.2 差错控制（50 页）、2.3 HDLC 及其初始化（40 页）、2.4 网络层和运输层的点对点协议（37 页）已发布 |
| 3 | 网络时延模型 | 3.1 时延的构成与 Little 定理（35 页）、3.2 M/M/m 型排队（31 页）、3.3 M/G/1 与 P-K 公式（36 页）、3.4 排队网络（32 页）已发布（第 3 章完成） |
| 4 | 多址接入协议 | 待补充 |
| 5 | 路由算法 | 待补充 |
| 6 | 流量和拥塞控制 | 待补充 |
| 7 | 通信网络前沿简介 | 待补充 |

## 仓库结构

```
index.html                 课程主页（简介 + 章 → 小节 → 课件 的目录菜单）
data/course.js             课程目录：主页的菜单完全由它生成
viewer/index.html          课件放映页   viewer/?deck=<deck-id>#<页码>
viewer/notes.html          讲者视图（由放映页按 S 打开）
assets/css, assets/js      主页与放映器的样式/脚本（无第三方依赖；仅加载 Google Fonts）
decks/<deck-id>/           每一讲课件
  deck.json                页序、分部、标题
  slides/<slide-id>.html   一页一个文件（1920×1080 画布，行内样式）
```

## 放映快捷键

`→ ↓ 空格` 下一步 · `← ↑` 上一步 · `N` 演讲备注 · `S` 讲者视图（备注 + 下一页预览 + 计时，可放在笔记本屏幕上，投影只显示课件）
`O` 总览 · `F` 全屏 · `B` 黑屏 · `T`/`R` 计时暂停/重置 · `?` 帮助 · URL 末尾 `#12` 直接跳到第 12 页

导出 PDF：在总览里点「导出 PDF」，或访问 `viewer/?deck=<deck-id>&print=auto`，在打印对话框里选「另存为 PDF」，纸张大小保持页面默认，边距「无」，勾选「背景图形」。

## 新增一讲课件

1. 把课件目录放到 `decks/<deck-id>/`（里面是 `deck.json` 和 `slides/*.html`）。
2. 在 `data/course.js` 对应章节的 `sections` 里加一项：`status: "ready"`，`deck: "<deck-id>"`，可选 `slides`、`minutes`、`desc`。
3. `git add . && git commit && git push`，GitHub Pages 会自动更新。

## 本地预览

页面通过 `fetch` 读取课件，所以需要一个本地 HTTP 服务（不能直接双击打开 `index.html`）：

```bash
python3 -m http.server 8000
# 然后打开 http://localhost:8000/
```

## 部署（GitHub Pages）

仓库 → **Settings → Pages → Build and deployment** → Source 选 **Deploy from a branch**，Branch 选 `main`，目录 `/ (root)`。
`.nojekyll` 已包含，GitHub 不会用 Jekyll 处理文件。

## 说明

- 页面使用 Google Fonts（Noto Serif SC、Noto Sans SC）；离线时回退到系统字体。
- 演讲备注（含练习题参考答案）保存在每页的 `<aside>` 里，随站点公开可见；如需保密，请在发布前删除对应内容。
