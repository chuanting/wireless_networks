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
        {
          no: "1.1", title: "通信网络概论：构成、交换方式与协议分层", status: "ready",
          desc: "为什么需要网络 · 终端、链路与节点 · 电路交换、虚电路与数据报 · 网络互连 · 协议与两军问题 · 五层模型、封装与两套地址",
          deck: "ch1-1-network-overview", slides: 26, minutes: 70
        },
        {
          no: "1.2", title: "数学基础：随机过程", status: "ready",
          desc: "随机过程的基本概念 · Poisson 过程（计数、指数间隔、无记忆、合并与分流）· 马尔可夫链（转移矩阵、稳态分布）· 生灭链与队列长度",
          deck: "ch1-2-stochastic-processes", slides: 31, minutes: 80
        },
        {
          no: "1.3", title: "数学基础：图论", status: "ready",
          desc: "图的概念：点、边、度 · 路径与回路：七桥问题、连通 · 树与最小生成树：Prim、Kruskal、分布式算法 · 割与割性质 · 最小生成树与最短路径树",
          deck: "ch1-3-graph-theory", slides: 32, minutes: 85
        },
        {
          no: "1.4", title: "通信网络的基本理论问题", status: "ready",
          desc: "用户关心什么 · 五个基本问题：拓扑与覆盖、传输与交换、多址、路由、流量控制 · 八个站点的连法 · 分组交换的时延 · 分组的旅程 · 数学工具与课程地图 · 课后实验",
          deck: "ch1-4-basic-problems", slides: 17, minutes: 43
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
          desc: "为什么组帧、帧与透明传输 · 字符组帧：串口、转义、SLIP、PPP · 比特组帧：Flag、比特插入（每 62 位插一个 0）、开销 · 长度计数与方法比较",
          deck: "ch2-1-framing", slides: 31, minutes: 85
        },
        {
          no: "2.2", title: "链路层的差错控制技术", status: "ready",
          desc: "一帧出错的概率 · 奇偶校验与 CRC（手算、为什么有效）· ARQ：停等式、序号、滑动窗口、返回 n、选择重发与效率公式 · 最佳帧长（单链路、多跳、语音）",
          deck: "ch2-2-error-control", slides: 35, minutes: 100
        },
        {
          no: "2.3", title: "标准数据链路控制协议及其初始化", status: "ready",
          desc: "为什么需要标准 · HDLC 的家族与三种模式 · 帧格式：地址、控制域、I/S/U 三类帧、P/F 位 · 工作过程：建立、捎带确认、轮询、REJ、RNR、拆除 · 链路的初始化：UP/DOWN、节点故障、三种办法",
          deck: "ch2-3-hdlc", slides: 30, minutes: 80
        },
        {
          no: "2.4", title: "网络层和运输层的点对点传输协议", status: "ready",
          desc: "为什么链路可靠还不够 · 虚电路与数据报，窗口与带宽时延积，逐跳与端到端重传，X.25 · TCP：端口、字节序号、三次握手与旧 SYN、ISN、四次挥手与 TIME_WAIT、累积确认与快速重传、RTO 估计与 RFC 规矩、接收窗口、窗口放大 · 与 HDLC 对照",
          deck: "ch2-4-e2e-protocols", slides: 35, minutes: 97
        }
      ]
    },
    {
      id: "ch3", no: 3, icon: "delay", title: "网络时延模型", en: "Network Delay Models",
      sections: [
        {
          no: "3.1", title: "时延的构成与 Little 定理", status: "ready",
          desc: "四种时延与存储转发 · 排队系统的描述（Kendall 记号、利用率与稳定）· 负荷与时延 · Little 定理的证明、条件与五个应用",
          deck: "ch3-1-delay-little", slides: 29, minutes: 100
        },
        {
          no: "3.2", title: "M/M/m 型排队系统", status: "ready",
          desc: "M/M/1 的稳态分布与时延公式 · 统计复用与切分 · 有限缓冲区 · M/M/m 与爱尔兰 C 公式 · 损失制与爱尔兰 B 公式",
          deck: "ch3-2-mm-queues", slides: 29, minutes: 100
        },
        {
          no: "3.3", title: "M/G/1 排队系统与 P-K 公式", status: "ready",
          desc: "P-K 公式的推导 · 方差的代价与重传 · 休假与 FDM/TDM/统计复用 · 轮询 · 优先级排队",
          deck: "ch3-3-mg1", slides: 29, minutes: 110
        },
        {
          no: "3.4", title: "排队网络", status: "ready",
          desc: "分组长度带着走 · Burke 定理 · Jackson 开放/封闭网络 · Kleinrock 近似、分流与检验",
          deck: "ch3-4-queue-networks", slides: 24, minutes: 100
        }
      ]
    },
    {
      id: "ch4", no: 4, icon: "mac", title: "多址接入协议", en: "Multiple Access Protocols",
      sections: [
        {
          no: "4.1", title: "概述与固定多址接入", status: "ready",
          desc: "共享信道与碰撞 · MAC 子层、两个极端与三大类协议 · 多址信道的排队模型、四个分析约定与评价指标 · FDMA / TDMA / CDMA / SDMA · 固定分配与理想总队列的时延差距",
          deck: "ch4-1-multiple-access", slides: 29, minutes: 73
        },
        {
          no: "4.2", title: "随机多址接入：ALOHA", status: "ready",
          desc: "从事先分好到谁有数据谁发 · ALOHA 的规则与分析模型（积压、λ、G、S） · 纯 ALOHA 与时隙 ALOHA 的通过率（1/(2e) 与 1/e） · 平衡点、马尔可夫链与漂移 · 重传概率的两难与固定 q 的堵塞 · 伪贝叶斯算法",
          deck: "ch4-2-aloha", slides: 29, minutes: 81
        },
        {
          no: "4.3", title: "载波侦听多址接入：CSMA", status: "ready",
          desc: "为什么先听还会撞：检测时延与 β · 三种坚持策略 · 非坚持 CSMA 的忙闲周期与通过率推导 · 时隙 CSMA 的漂移、最大通过率与稳定算法 · CSMA/CD、最短帧长、以太网的指数退避 · 隐藏终端与 Wi-Fi 的 CSMA/CA",
          deck: "ch4-3-csma", slides: 28, minutes: 83
        },
        {
          no: "4.4", title: "冲突分解算法", status: "ready",
          desc: "撞了先解开：冲突分解期 · 两个分组的例子 · 树形分裂（栈与计数器、分解期长度 L(n)、基本版 0.347）· 两步改进（0.4295、0.4623）· FCFS 分裂（指配区间、还回去、四条规则、马尔可夫链、0.4871）· 时延仿真 · 前提与 RFID 查询树",
          deck: "ch4-4-collision-resolution", slides: 28, minutes: 84
        }
      ]
    },
    {
      id: "ch5", no: 5, icon: "route", title: "路由算法", en: "Routing Algorithms",
      sections: [
        {
          no: "5.1", title: "路由算法概述", status: "ready",
          desc: "路由要解决什么 · 数据报与虚电路 · 路由的好坏：时延与通过量 · 五种分类与六项要求 · 路由表、逐跳转发、环路与最长前缀匹配 · 洪泛与三种广播 · 分级路由与自治系统 · 自组织网络",
          deck: "ch5-1-routing-overview", slides: 29, minutes: 70
        },
        {
          no: "5.2", title: "集中式最短路由算法", status: "ready",
          desc: "最短路径问题 · Bellman–Ford（递推、Bellman 方程、证明、负环、运算量）· Dijkstra（三步、例子、证明、不能有负长度）· Floyd–Warshall（矩阵、下一跳）· 三种算法的比较与用途",
          deck: "ch5-2-shortest-path", slides: 23, minutes: 58
        },
        {
          no: "5.3", title: "分布式路由：距离矢量与链路状态", status: "ready",
          desc: "没有中心：每个节点独立地算 · 距离矢量（分布式的 Bellman–Ford、好消息与坏消息、计数到无穷、水平分割、RIP）· 链路状态（发现、测量、构造、洪泛、Dijkstra）· 两者比较 · OSPF 与 IS-IS",
          deck: "ch5-3-distributed-routing", slides: 20, minutes: 50
        },
        {
          no: "5.4", title: "稳定性与路由信息的广播", status: "ready",
          desc: "自适应最短路由的稳定性：链路长度与流量的反馈 · 16 节点环的整体振荡 · 偏置因子与多周期平均 · 路由信息的广播：旧消息、简单洪泛、序号、序号出错、年龄与周期更新",
          deck: "ch5-4-stability-broadcast", slides: 19, minutes: 48
        }
      ]
    },
    { id: "ch6", no: 6, icon: "traffic", title: "流量和拥塞控制", en: "Traffic & Congestion Control", sections: [
        {
          no: "6.1", title: "流量与拥塞控制概论", status: "ready",
          desc: "负载超过处理能力的恶性循环 · 有效吞吐量先升后降 · 死锁 · 流量控制、拥塞控制与死锁防止 · 公平与吞吐量、时延与功率的取舍 · 基本原理、开环与闭环、各层的做法",
          deck: "ch6-1-congestion-overview", slides: 17, minutes: 42
        },
        {
          no: "6.2", title: "流量与拥塞控制的技术", status: "ready",
          desc: "窗口式控制（速率 min{1/x, W/d}、多会话时延、往返时延带来的不公平、动态调整、TCP 的加性增乘性减）· 业务整形（漏桶、令牌桶、突发长度）· 令牌桶里的分组等多久 · 用在哪里",
          deck: "ch6-2-window-token-bucket", slides: 23, minutes: 61
        }
      ] },
    { id: "ch7", no: 7, icon: "sixg", title: "通信网络前沿简介", en: "Frontiers of Communication Networks", sections: [] }
  ]
};
