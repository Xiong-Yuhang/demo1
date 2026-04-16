# 项目简介

这是一个基于Vue3 + TypeScript + Vant + Vite的智能家居设备管理Demo项目。项目实现了用户登录、设备列表展示、四通道插座设备控制等功能，并通过WebSocket实现了设备的实时控制和状态同步。

# 技术栈

Vue 3：前端框架
TypeScript：类型安全的JavaScript超集
Vant：移动端UI组件库
Vite：前端构建工具
Vue Router：路由管理
Axios：HTTP客户端
WebSocket：实时通信

# 项目结构

src/
├── api/ # API接口层
│ ├── axios.ts # Axios实例配置和拦截器
│ ├── index.ts # API函数定义
│ ├── index.d.ts # 类型定义
│ └── websocket.ts # WebSocket管理类
├── components/ # 公共组件
│ └── DeviceCard.vue # 设备卡片组件
├── router/ # 路由配置
│ └── index.ts
├── views/ # 页面组件
│ ├── Login.vue # 登录页面
│ └── Home.vue # 主页
├── App.vue # 根组件
└── main.ts # 应用入口
