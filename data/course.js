/*
 * 课程目录（单一数据源）。主页的「章 → 小节 → 课件」菜单完全由这里生成。
 *
 * 新增一讲课件的步骤：
 *   1. 把课件放到 decks/<deck-id>/（里面是 deck.json 和 slides/*.html）
 *   2. 在下面对应章节的 sections 里加一项，status 设为 "ready"，deck 填 <deck-id>
 *   3. 提交并推送，GitHub Pages 会自动更新
 */
window.COURSE = {
  title: "现代通信网络",
  en: "Modern Communication Networks",
  repo: "https://github.com/chuanting/wireless_networks",
  chapters: [
    {
      id: "ch1", no: 1, icon: "graph",
      title: "通信网络概论及数学基础",
      en: "Introduction & Mathematical Foundations",
      sections: [
        { no: "1.1", title: "课件待补充", status: "todo" },
        {
          no: "1.2", title: "数学基础：随机过程", status: "ready",
          desc: "随机过程的基本概念 · Poisson 过程 · 马尔可夫链",
          deck: "ch1-2-stochastic-processes", slides: 38, minutes: 60
        },
        {
          no: "1.3", title: "数学基础：图论", status: "ready",
          desc: "图的概念 · 路径与回路 · 生成树与最小生成树 · 割集",
          deck: "ch1-3-graph-theory", slides: 48, minutes: 60
        }
      ]
    },
    {
      id: "ch2", no: 2, icon: "transport",
      title: "端到端的传输协议",
      en: "End-to-End Transport Protocols",
      sections: [
        {
          no: "2.1", title: "组帧技术", status: "ready",
          desc: "为什么组帧 · 字符组帧（SLIP、PPP）· 比特插入（HDLC）· 帧的开销 · 长度计数",
          deck: "ch2-1-framing", slides: 51, minutes: 90
        },
        {
          no: "2.2", title: "链路层的差错控制技术", status: "ready",
          desc: "差错检测（奇偶校验、CRC）· ARQ 协议（停等、返回 n、选择重发）· 最佳帧长",
          deck: "ch2-2-error-control", slides: 55, minutes: 100
        },
        {
          no: "2.3", title: "标准数据链路控制协议及其初始化", status: "ready",
          desc: "HDLC 家族与工作模式 · 帧格式（I、S、U 帧）· 工作过程（建立、捎带确认、REJ、RNR）· 链路初始化与节点故障",
          deck: "ch2-3-hdlc", slides: 40, minutes: 90
        },
        {
          no: "2.4", title: "网络层和运输层的点对点传输协议", status: "ready",
          desc: "为什么链路可靠还不够 · 虚电路与数据报 · 端到端窗口 · X.25 · TCP（端口、握手挥手、可靠传输、重传定时器、流量控制）",
          deck: "ch2-4-e2e-protocols", slides: 37, minutes: 100
        }
      ]
    },
    {
      id: "ch3", no: 3, icon: "delay", title: "网络时延模型", en: "Network Delay Models",
      sections: [
        {
          no: "3.1", title: "时延的构成与 Little 定理", status: "ready",
          desc: "四种时延 · 排队系统的描述（Kendall 记号、利用率）· Little 定理的证明与五个应用",
          deck: "ch3-1-delay-little", slides: 35, minutes: 100
        },
        {
          no: "3.2", title: "M/M/m 型排队系统", status: "ready",
          desc: "M/M/1 的稳态分布与时延公式 · 统计复用 · 有限缓冲区 · M/M/m、爱尔兰 C 与 B 公式",
          deck: "ch3-2-mm-queues", slides: 31, minutes: 100
        },
        {
          no: "3.3", title: "M/G/1 排队系统与 P-K 公式", status: "ready",
          desc: "P-K 公式的推导与方差的代价 · ARQ 时延 · 休假与 FDM/TDM 复用 · 轮询系统 · 优先级排队",
          deck: "ch3-3-mg1", slides: 36, minutes: 110
        },
        {
          no: "3.4", title: "排队网络", status: "ready",
          desc: "为什么网络里的队列难分析 · Burke 定理 · Jackson 开放/封闭网络 · Kleinrock 独立性近似与路由分流",
          deck: "ch3-4-queue-networks", slides: 32, minutes: 100
        }
      ]
    },
    {
      id: "ch4", no: 4, icon: "mac", title: "多址接入协议", en: "Multiple Access Protocols",
      sections: [
        {
          no: "4.1", title: "概述与固定多址接入", status: "ready",
          desc: "共享信道与碰撞 · MAC 子层与三类协议 · 多址信道的排队模型与评价指标 · FDMA / TDMA / CDMA / SDMA · 固定分配的时延代价",
          deck: "ch4-1-multiple-access", slides: 36, minutes: 100
        },
        {
          no: "4.2", title: "随机多址接入：ALOHA", status: "ready",
          desc: "ALOHA 的规则与模型 · 纯 ALOHA 与时隙 ALOHA 的通过率（1/2e 与 1/e）· 平衡点、马尔可夫链与漂移 · 为什么会堵死 · 伪贝叶斯算法",
          deck: "ch4-2-aloha", slides: 37, minutes: 100
        },
        {
          no: "4.3", title: "载波侦听多址接入：CSMA", status: "ready",
          desc: "为什么还会碰撞与检测时延 β · 三种坚持策略 · 非时隙 CSMA 的通过率推导 · 时隙 CSMA 的漂移与稳定算法 · CSMA/CD、最短帧长、以太网与 CSMA/CA",
          deck: "ch4-3-csma", slides: 35, minutes: 100
        },
        {
          no: "4.4", title: "冲突分解算法", status: "ready",
          desc: "撞了先解开：冲突分解期 · 树形分裂算法（栈与计数器、分解期长度）· 三个改进（0.43、0.46）· FCFS 分裂算法（指配区间、四条规则、稳定条件 0.487）· 上界与 RFID 应用",
          deck: "ch4-4-collision-resolution", slides: 37, minutes: 100
        }
      ]
    },
    { id: "ch5", no: 5, icon: "route", title: "路由算法", en: "Routing Algorithms", sections: [] },
    { id: "ch6", no: 6, icon: "traffic", title: "流量和拥塞控制", en: "Traffic & Congestion Control", sections: [] },
    { id: "ch7", no: 7, icon: "sixg", title: "通信网络前沿简介", en: "Frontiers of Communication Networks", sections: [] }
  ]
};
