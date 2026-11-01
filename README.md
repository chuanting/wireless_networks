# 现代通信网络 · Modern Communication Networks

课程讲义站点（纯静态，托管在 GitHub Pages）。打开主页 → 点击一章 → 点击小节 → 直接在浏览器里放映课件。

**在线地址**：<https://chuanting.github.io/wireless_networks/>

## 课程结构

| 章 | 题目 | 课件 |
|---|---|---|
| 1 | 通信网络概论及数学基础 | 1.1 通信网络概论（27 页）、1.2 数学基础：随机过程（32 页）、1.3 数学基础：图论（33 页）、1.4 通信网络的基本理论问题（18 页）已发布（第 1 章完成） |
| 2 | 端到端的传输协议 | 2.1 组帧技术（32 页）、2.2 差错控制（36 页）、2.3 HDLC 及其初始化（31 页）、2.4 网络层和运输层的点对点协议（36 页）已发布（第 2 章完成） |
| 3 | 网络时延模型 | 3.1 时延的构成与 Little 定理（32 页）、3.2 M/M/1 排队模型与拓展（45 页，核心 26 页）、3.3 M/G/1 与 P-K 公式（31 页）、3.4 排队网络（26 页）已发布（第 3 章完成） |
| 4 | 多址接入协议 | 4.1 概述与固定多址接入（30 页）、4.2 随机多址接入：ALOHA（30 页）、4.3 载波侦听多址接入：CSMA（29 页）、4.4 冲突分解算法（29 页）已发布（第 4 章完成） |
| 5 | 路由算法 | 5.1 路由算法概述（30 页）、5.2 集中式最短路由算法（24 页）、5.3 分布式路由（21 页）、5.4 稳定性与路由信息的广播（20 页）已发布（第 5 章完成） |
| 6 | 流量和拥塞控制 | 6.1 流量与拥塞控制概论（18 页）、6.2 流量与拥塞控制的技术（24 页）已发布（第 6 章完成） |
| 7 | 通信网络前沿简介 | 7.1 新的链路（16 页）、7.2 新的架构（15 页）已发布（第 7 章完成） |

全课共 24 讲、665 页。每讲封面后新增 `study-route` 目标页，列出本讲要解决的问题、学习目标和讲授路线。

3.1 末页包含排队与时延 live demo：切换均匀/泊松到达、调整到达率和固定服务时间，观察队列、单个分组的时间组成与运行统计。可暂停、逐事件推进、快进，以及停止到达并排空后用同一批分组核对 Little 定理。模型为单服务员、先来先服务、无限缓冲，不包含传播时延。参数变化会重新开始；离页或打开总览等面板会暂停。总览、讲者预览和打印显示静态实验说明。验证页面为 `tests/queue-model-tests.html`、`tests/queue-demo-tests.html` 和 `tests/queue-viewer-tests.html`，通过本地 HTTP 服务在浏览器中打开；连续播放检查使用真实浏览器时钟。

3.2 按零背景本科生重排：先解释为什么平均服务能力够仍会排队，再以 λ = 4 个/s、μ = 5 个/s 贯穿符号、人数状态、稳态概率、Little 关系与平均时间。核心 26 页，包含前置的单服务员入门演示；其余 19 页为拓展，保留求和推导、等待概率、有限容量、多服务员与爱尔兰公式。入门演示只显示一个服务员、到达率、忙时处理能力和运行统计；完整演示保留在拓展末页。公式卡的时间统一为秒。直接打开核心路线：`viewer/?deck=ch3-2-mm-queues&core=1`。

3.2、3.3、3.4 的末页也提供独立实验：

| 讲次 | 课堂实验 | 主要观察 |
|---|---|---|
| 3.2 | 改变服务员数量，切换排队与损失制 | 等待、拒绝、服务能力与 Erlang 公式 |
| 3.3 | 相同到达时刻、相同平均服务时间，比较三种服务分布 | 服务波动、二阶矩与 P-K 平均等待 |
| 3.4 | CPU–I/O 反馈网络，改变反馈概率与节点服务率 | 内部访问流量、瓶颈与全网时延 |

这些演示沿用进入时暂停、修改参数重置的操作方式，理论稳态值与有限仿真样本分开显示；3.3 的末页也保留在核心教学路线中。每个演示的模型和界面检查分别见 `tests/mm-queue-tests.html`、`tests/mg1-demo-tests.html`、`tests/network-queue-tests.html`，跨课件放映检查见 `tests/ch3-demos-tests.html`。主放映器按演示标识加载模块，讲者预览、总览和打印仍使用各页的静态实验说明。

## 仓库结构

```
index.html                 课程主页（简介 + 章 → 小节 → 课件 的目录菜单）
data/course.js             课程目录：主页的菜单完全由它生成
viewer/index.html          课件放映页   viewer/?deck=<deck-id>#<页码>
viewer/notes.html          讲者视图（由放映页按 S 打开）
assets/css, assets/js      主页与放映器的样式/脚本（无第三方依赖）
assets/fonts               本地思源黑体 400/500/700（精简字库，woff2）
decks/<deck-id>/           每一讲课件
  deck.json                页序、分部、标题、字体和核心/拓展教学配置
  slides/<slide-id>.html   一页一个文件（1920×1080 画布，行内样式）
```

## 放映快捷键

`→ ↓ 空格` 下一步 · `← ↑` 上一步 · `N` 演讲备注 · `S` 讲者视图（备注 + 下一页预览 + 计时，可放在笔记本屏幕上，投影只显示课件）
`O` 总览 · `F` 全屏 · `B` 黑屏 · `T`/`R` 计时暂停/重置 · `?` 帮助 · URL 末尾 `#12` 直接跳到第 12 页

导出 PDF：在总览里点「导出 PDF」，或访问 `viewer/?deck=<deck-id>&print=auto`，在打印对话框里选「另存为 PDF」，纸张大小保持页面默认，边距「无」，勾选「背景图形」。

3.2、3.3 和 4.4 提供「只讲核心」按钮，放映栏和总览均可切换。核心模式跳过拓展页，沿用完整课件的页码，页码可能不连续；再次点击恢复完整课件。总览中的「导出 PDF」遵循当前选择，直接打印核心内容可用 `viewer/?deck=<deck-id>&core=1&print=auto`。

Prim、ARQ 和 Dijkstra 等关键页采用“先判断、后揭晓”：先让学生回答页面问题，再用下一步显示图、推导或答案。全部讲次的课后实验加入控制变量对照，先核对基线模型，再改变一个假设，观察结果为什么偏离。讲者备注包含提问提示和参考解释。

## 修改与重新生成

内容源在站点上级的项目目录：`gen11` 到 `gen72` 保存各讲正文、讲稿、图和计算脚本，`genlib` 保存公共模板。修改内容源后，在项目根目录（`wireless_networks` 与 `genlib` 的共同上级）运行：

```bash
python genlib/rebuild.py
```

该命令重建全部课件，并同步 `data/course.js` 的页数。每讲的学习目标与核心/拓展配置在 `genlib/teaching.json`。直接修改生成的 `slides/*.html` 会在下次构建时被覆盖。

字体使用本地思源黑体（Noto Sans CJK SC，对外字体名为 Noto Sans SC），包含 400、500、700 三个字重。正文、标题和黑板讲解统一使用无衬线字形，数学公式保留 Times New Roman，缺失时回退到 Georgia 或系统衬线字体。

增加字库未覆盖的字符或更新字体时，在项目根运行：

```bash
python genlib/fonts.py
# 字体源不在默认目录时：
python genlib/fonts.py /path/to/noto-fonts
```

字体脚本需要 `fonttools`、`brotli`，默认读取 `/usr/share/fonts/opentype/noto` 下的 `NotoSansCJK-Regular.ttc`、`NotoSansCJK-Medium.ttc`、`NotoSansCJK-Bold.ttc`，输出到 `wireless_networks/assets/fonts/`。少量扩展拉丁字母和数学符号由本地 DejaVu Sans 补齐，默认源文件为 `/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf`，可用脚本第二个参数指定。日常使用已生成的课件无需安装这些构建依赖。

## 新增一讲课件

1. 把课件目录放到 `decks/<deck-id>/`（里面是 `deck.json` 和 `slides/*.html`）。
2. 在 `data/course.js` 对应章节的 `sections` 里加一项：`status: "ready"`，`deck: "<deck-id>"`，可选 `slides`、`minutes`、`desc`。
3. `git add . && git commit && git push`，GitHub Pages 会自动更新。

## 本地预览

页面通过 `fetch` 读取课件，所以需要一个本地 HTTP 服务。在 `wireless_networks` 目录运行（不能直接双击打开 `index.html`）：

```bash
python3 -m http.server 8000
# 然后打开 http://localhost:8000/
```

## 部署（GitHub Pages）

仓库 → **Settings → Pages → Build and deployment** → Source 选 **Deploy from a branch**，Branch 选 `main`，目录 `/ (root)`。
`.nojekyll` 已包含，GitHub 不会用 Jekyll 处理文件。

## 说明

- 当前课程的中文字体从本站 `assets/fonts/` 加载，不依赖 Google Fonts。字库包含生成源、页面内容和 GB2312 一级常用字；新增生僻字后可重建字体。当前字体许可见 `assets/fonts/NotoSansCJK-LICENSE.txt` 和 `assets/fonts/DejaVu-LICENSE.txt`。
- 数值核对脚本为各目录中的 `verify*.py`，格式与字体覆盖检查为 `check.py`；按各讲 README 的命令运行。脚本检查与浏览器放映、全屏及打印检查分别进行。
- 演讲备注（含练习题参考答案）保存在每页的 `<aside>` 里，随站点公开可见；如需保密，请在发布前删除对应内容。
