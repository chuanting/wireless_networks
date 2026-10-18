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
          deck: "ch2-2-error-control", slides: 50, minutes: 100
        },
        { no: "2.3", title: "标准数据链路控制协议及其初始化", status: "todo" },
        { no: "2.4", title: "网络层和运输层的点对点传输协议", status: "todo" }
      ]
    },
    { id: "ch3", no: 3, icon: "delay", title: "网络时延模型", en: "Network Delay Models", sections: [] },
    { id: "ch4", no: 4, icon: "mac", title: "多址接入协议", en: "Multiple Access Protocols", sections: [] },
    { id: "ch5", no: 5, icon: "route", title: "路由算法", en: "Routing Algorithms", sections: [] },
    { id: "ch6", no: 6, icon: "traffic", title: "流量和拥塞控制", en: "Traffic & Congestion Control", sections: [] },
    { id: "ch7", no: 7, icon: "sixg", title: "通信网络前沿简介", en: "Frontiers of Communication Networks", sections: [] }
  ]
};
