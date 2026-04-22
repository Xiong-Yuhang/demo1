import { showFailToast } from "vant";

// WebSocket 连接状态枚举
export enum WebSocketStatus {
  CONNECTING = "connecting",
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
  ERROR = "error",
}

// WebSocket 消息类型
export interface WebSocketMessage {
  action?: string;
  deviceid?: string;
  apikey?: string;
  params?: any;
  error?: number;
  sequence?: string;
  [key: string]: any;
}

// 设备状态更新回调函数类型
export type DeviceUpdateCallback = (deviceId: string, params: any) => void;
// 设备在线状态回调函数类型
export type DeviceOnlineCallback = (deviceId: string, online: boolean) => void;

// WebSocket 管理类
class WebSocketManager {
  private ws: WebSocket | null = null;
  private status: WebSocketStatus = WebSocketStatus.DISCONNECTED;
  private pingTimer: number | null = null;
  private pongTimer: number | null = null; // 新增：等待pong响应的定时器
  private reconnectTimer: number | null = null;
  private heartbeatInterval: number = 90; // 默认心跳间隔
  private appId: string = import.meta.env.VITE_APP_ID;
  private deviceUpdateCallbacks: Map<string, DeviceUpdateCallback[]> =
    new Map(); // 设备状态更新回调列表
  private deviceOnlineCallbacks: Map<string, DeviceOnlineCallback[]> =
    new Map(); // 设备在线状态回调列表
  private messageHandlers: Map<string, (message: WebSocketMessage) => void> =
    new Map(); // 消息处理器映射
  private sequenceCallbacks: Map<string, (message: WebSocketMessage) => void> =
    new Map(); // sequence 回调映射
  private pongTimeoutCount: number = 0;
  private readonly MAX_PONG_TIMEOUT_COUNT: number = 3; // 最大pong超时次数

  // 连接状态变更回调
  public onStatusChange?: (status: WebSocketStatus) => void;

  constructor() {
    this.setupMessageHandlers();
  }

  // 设置消息处理器
  private setupMessageHandlers() {
    this.messageHandlers.set("update", this.handleUpdateMessage.bind(this));
    this.messageHandlers.set("sysmsg", this.handleSysmsgMessage.bind(this));
  }

  // 连接到 WebSocket 服务器
  public async connect(): Promise<boolean> {
    if (
      this.status === WebSocketStatus.CONNECTING ||
      this.status === WebSocketStatus.CONNECTED
    ) {
      console.log("WebSocket 已连接或正在连接");
      return true;
    }

    try {
      // 获取分配服务地址
      const dispatchUrl = this.getDispatchUrl();
      const dispatchResult = await this.getDispatchServer(dispatchUrl);

      if (dispatchResult.error !== 0) {
        throw new Error(`获取WebSocket服务器失败: ${dispatchResult.reason}`);
      }

      // 构建 WebSocket URL
      const wsUrl = `wss://${dispatchResult.domain}:${dispatchResult.port}/api/ws`;
      console.log("连接 WebSocket:", wsUrl);

      this.updateStatus(WebSocketStatus.CONNECTING);
      this.ws = new WebSocket(wsUrl);

      // 设置事件监听器
      this.setupEventListeners();

      return new Promise((resolve) => {
        const checkConnect = () => {
          if (this.status === WebSocketStatus.CONNECTED) {
            resolve(true);
          } else if (this.status === WebSocketStatus.ERROR) {
            resolve(false);
          } else {
            setTimeout(checkConnect, 100);
          }
        };
        setTimeout(checkConnect, 100);
      });
    } catch (error) {
      console.error("WebSocket连接失败:", error);
      this.updateStatus(WebSocketStatus.ERROR);
      showFailToast("WebSocket连接失败");
      return false;
    }
  }

  // 获取分配服务地址
  private getDispatchUrl(): string {
    const region = localStorage.getItem("user_region") || "cn";

    const dispatchUrls: Record<string, string> = {
      cn: "https://cn-dispa.coolkit.cn/dispatch/app",
      us: "https://us-dispa.coolkit.cc/dispatch/app",
      eu: "https://eu-dispa.coolkit.cc/dispatch/app",
      as: "https://as-dispa.coolkit.cc/dispatch/app",
    };

    return dispatchUrls[region] || dispatchUrls.cn;
  }

  // 获取分配服务器信息
  private async getDispatchServer(url: string): Promise<any> {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("获取分配服务器失败:", error);
      throw error;
    }
  }

  // 设置事件监听器
  private setupEventListeners() {
    if (!this.ws) return;

    this.ws.onopen = this.handleOpen.bind(this);

    this.ws.onmessage = this.handleMessage.bind(this);

    this.ws.onerror = this.handleError.bind(this);

    this.ws.onclose = this.handleClose.bind(this);
  }

  // 连接建立后的处理
  private async handleOpen() {
    try {
      // 发送握手认证消息
      const handshakeSuccess = await this.sendHandshake();
      if (handshakeSuccess) {
        this.updateStatus(WebSocketStatus.CONNECTED);
        this.resetPongTimeoutCount(); // 重置心跳超时计数
      } else {
        throw new Error("握手认证失败");
      }
    } catch (error) {
      console.error("握手认证失败:", error);
      this.updateStatus(WebSocketStatus.ERROR);
      this.ws?.close();
    }
  }

  // 发送握手认证
  private async sendHandshake(): Promise<boolean> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    const at = localStorage.getItem("access_token");
    const userInfoStr = localStorage.getItem("user_info");
    const userInfo = userInfoStr ? JSON.parse(userInfoStr) : null;
    const apikey = userInfo?.apikey;

    if (!at || !apikey) {
      console.error("缺少认证信息");
      return false;
    }

    // 生成随机字符串
    const generateNonce = (length: number = 8): string => {
      const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      let result = "";
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    const sequence = Date.now().toString();
    const handshakeMessage = {
      action: "userOnline",
      version: 8,
      ts: Math.floor(Date.now() / 1000),
      at,
      userAgent: "app",
      apikey,
      appid: this.appId,
      nonce: generateNonce(),
      sequence,
    };

    console.log("发送握手消息:", handshakeMessage);

    return new Promise((resolve) => {
      const messageHandler = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          console.log("收到握手响应:", data);

          // 通过 sequence 字段匹配
          if (data.sequence === sequence) {
            this.ws?.removeEventListener("message", messageHandler);

            if (data.error === 0) {
              console.log("握手认证成功", data);
              // 设置心跳
              if (data.config?.hb === 1) {
                this.setupHeartbeat(data.config.hbInterval);
              }
              resolve(true);
            } else {
              console.error("握手认证失败:", data);
              resolve(false);
            }
          }
        } catch (error) {
          console.error("解析握手响应失败:", error);
          resolve(false);
        }
      };

      this.ws?.addEventListener("message", messageHandler);
      this.ws?.send(JSON.stringify(handshakeMessage));
    });
  }

  // 设置心跳
  private setupHeartbeat(interval: number) {
    this.heartbeatInterval = interval;

    // 清除现有的定时器
    this.clearHeartbeatTimers();

    // 计算心跳间隔（减去7秒，并添加随机性）
    const heartbeatTime = Math.max((this.heartbeatInterval - 7) * 1000, 10000); // 最小10秒
    const randomTime = heartbeatTime * (0.8 + Math.random() * 0.2);

    console.log("设置心跳间隔:", randomTime, "ms");

    this.pingTimer = window.setInterval(() => {
      this.sendHeartbeat();
    }, randomTime);
  }

  // 发送心跳
  private sendHeartbeat() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log("WebSocket 未连接，停止心跳");
      this.cleanup();
      return;
    }

    try {
      // 发送字符串 "ping"
      this.ws.send("ping");
      console.log("发送心跳: ping");

      // 设置等待pong响应的超时定时器
      this.setupPongTimeout();
    } catch (error) {
      console.error("发送心跳失败:", error);
      this.handleHeartbeatFailure();
    }
  }

  // 设置pong响应超时定时器
  private setupPongTimeout() {
    // 清除之前的pong定时器
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }

    // 设置新的pong超时定时器（心跳间隔的一半，但至少5秒）
    const pongTimeout = Math.max((this.heartbeatInterval * 1000) / 2, 5000);

    this.pongTimer = window.setTimeout(() => {
      console.error("心跳响应超时，未收到pong");
      this.handlePongTimeout();
    }, pongTimeout);
  }

  // 处理pong超时
  private handlePongTimeout() {
    this.pongTimer = null;
    this.pongTimeoutCount++;

    console.warn(`心跳超时 ${this.pongTimeoutCount} 次`);

    if (this.pongTimeoutCount >= this.MAX_PONG_TIMEOUT_COUNT) {
      console.error(`心跳连续超时 ${this.MAX_PONG_TIMEOUT_COUNT} 次，触发重连`);
      this.handleHeartbeatFailure();
    }
  }

  // 处理心跳失败
  private handleHeartbeatFailure() {
    console.error("心跳失败，触发重连");
    this.reconnect();
  }

  // 重置pong超时计数
  private resetPongTimeoutCount() {
    this.pongTimeoutCount = 0;
  }

  // 清除心跳相关定时器
  private clearHeartbeatTimers() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }

    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  // 处理接收到的消息
  private handleMessage(event: MessageEvent) {
    try {
      // 首先检查是否是字符串消息（如pong）
      if (typeof event.data === "string") {
        const messageStr = event.data.trim();

        // 处理心跳响应
        if (messageStr === "pong") {
          this.handlePongResponse();
          return; // 心跳响应不需要进一步处理
        }

        // 如果不是pong，尝试解析为JSON
        const message: WebSocketMessage = JSON.parse(event.data);
        this.processJsonMessage(message);
      } else {
        console.log("收到非字符串消息:", event.data);
      }
    } catch (error) {
      console.error("解析WebSocket消息失败:", error, event.data);
    }
  }

  // 处理pong响应
  private handlePongResponse() {
    // 清除pong超时定时器
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }

    // 重置超时计数
    this.resetPongTimeoutCount();
  }

  // 处理JSON消息
  private processJsonMessage(message: WebSocketMessage) {
    console.log("收到WebSocket消息:", message);

    // 先处理 sequence 回调
    if (message.sequence && this.sequenceCallbacks.has(message.sequence)) {
      const callback = this.sequenceCallbacks.get(message.sequence);
      if (callback) {
        console.log("调用 sequence 回调:", message.sequence);
        callback(message);
        this.removeSequenceCallback(message.sequence);
        return;
      }
    }

    // 然后处理 action 消息
    if (message.action) {
      console.log("处理 action 消息:", message.action);
      const handler = this.messageHandlers.get(message.action);
      if (handler) {
        handler(message);
      } else {
        console.log("未处理的消息类型:", message.action);
      }
    } else if (message.error !== undefined) {
      console.log("收到无action的响应消息:", message);
    } else {
      console.log("未知格式的消息:", message);
    }
  }

  // 处理update消息
  private handleUpdateMessage(message: WebSocketMessage) {
    // 服务器推送的状态更新
    if (message.deviceid && message.params) {
      // 获取这个设备的所有回调
      const callbacks = this.deviceUpdateCallbacks.get(message.deviceid) || [];

      // 执行所有回调
      callbacks.forEach((callback, index) => {
        try {
          callback(message.deviceid!, message.params);
        } catch (error) {
          console.error(`回调 ${index + 1} 执行失败:`, error);
        }
      });
    }
  }

  // 处理sysmsg消息（设备在线状态更新）
  private handleSysmsgMessage(message: WebSocketMessage) {
    if (message.deviceid && message.params?.online !== undefined) {
      const callbacks = this.deviceOnlineCallbacks.get(message.deviceid) || [];
      callbacks.forEach((callback) => {
        callback(message.deviceid!, message.params.online);
      });
    }
  }

  // 处理错误
  private handleError() {
    this.updateStatus(WebSocketStatus.ERROR);
    this.cleanup();
  }

  // 处理连接关闭
  private handleClose(event: CloseEvent) {
    this.updateStatus(WebSocketStatus.DISCONNECTED);
    this.cleanup();

    // 尝试重连
    if (!event.wasClean) {
      this.scheduleReconnect();
    }
  }

  // 清理资源
  private cleanup() {
    this.clearHeartbeatTimers();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // 清理所有 sequence 回调
    this.sequenceCallbacks.clear();

    // 重置心跳统计
    this.resetPongTimeoutCount();
  }

  // 安排重连
  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      console.log("尝试重新连接...");
      this.connect();
    }, 5000); // 5秒后重连
  }

  // 更新状态
  private updateStatus(newStatus: WebSocketStatus) {
    this.status = newStatus;
    if (this.onStatusChange) {
      this.onStatusChange(newStatus);
    }
  }

  // 注册 sequence 回调
  private registerSequenceCallback(
    sequence: string,
    callback: (message: WebSocketMessage) => void,
  ) {
    this.sequenceCallbacks.set(sequence, callback);
  }

  // 移除 sequence 回调
  private removeSequenceCallback(sequence: string) {
    this.sequenceCallbacks.delete(sequence);
  }

  // 发送控制指令
  public sendControlCommand(deviceId: string, params: any): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        console.error("WebSocket未连接，当前状态:", this.ws?.readyState);
        showFailToast("WebSocket连接已断开");
        resolve(false);
        return;
      }

      const at = localStorage.getItem("access_token");
      const userInfoStr = localStorage.getItem("user_info");
      const userInfo = userInfoStr ? JSON.parse(userInfoStr) : null;
      const apikey = userInfo?.apikey;

      if (!at || !apikey) {
        console.error("缺少认证信息");
        showFailToast("未登录，请重新登录");
        resolve(false);
        return;
      }

      const sequence = Date.now().toString();
      const controlMessage = {
        action: "update",
        deviceid: deviceId,
        apikey: apikey,
        userAgent: "app",
        sequence: sequence,
        params: params,
      };

      console.log("发送控制指令:", JSON.stringify(controlMessage, null, 2));

      // 注册 sequence 回调
      this.registerSequenceCallback(sequence, (response: WebSocketMessage) => {
        console.log("收到控制响应:", response);
        if (response.error === 0) {
          console.log("控制指令发送成功");
          resolve(true);
        } else {
          console.error("控制指令失败:", response);
          showFailToast(`控制失败: ${response.error}`);
          resolve(false);
        }
      });

      try {
        this.ws.send(JSON.stringify(controlMessage));
      } catch (error) {
        console.error("发送控制指令失败:", error);
        this.removeSequenceCallback(sequence);
        showFailToast("发送控制指令失败");
        resolve(false);
      }

      // 设置超时
      setTimeout(() => {
        if (this.sequenceCallbacks.has(sequence)) {
          this.removeSequenceCallback(sequence);
          console.error("控制指令超时");
          showFailToast("控制指令超时");
          resolve(false);
        }
      }, 8000);
    });
  }

  // 查询设备状态
  public queryDeviceStatus(
    deviceId: string,
    params: string[] = [],
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket未连接"));
        return;
      }

      const at = localStorage.getItem("access_token");
      const userInfoStr = localStorage.getItem("user_info");
      const userInfo = userInfoStr ? JSON.parse(userInfoStr) : null;
      const apikey = userInfo?.apikey;

      if (!at || !apikey) {
        reject(new Error("缺少认证信息"));
        return;
      }

      const sequence = Date.now().toString();
      const queryMessage = {
        action: "query",
        deviceid: deviceId,
        apikey: apikey,
        userAgent: "app",
        sequence: sequence,
        params,
      };

      // 注册 sequence 回调
      this.registerSequenceCallback(sequence, (response: WebSocketMessage) => {
        if (response.error === 0) {
          resolve(response.params);
        } else {
          reject(new Error(`查询失败: ${response.error}`));
        }
      });

      this.ws.send(JSON.stringify(queryMessage));
      console.log("发送查询指令:", queryMessage);

      // 设置超时
      setTimeout(() => {
        this.removeSequenceCallback(sequence);
        reject(new Error("查询超时"));
      }, 5000);
    });
  }

  // 注册设备更新回调
  public onDeviceUpdate(deviceId: string, callback: DeviceUpdateCallback) {
    if (!this.deviceUpdateCallbacks.has(deviceId)) {
      this.deviceUpdateCallbacks.set(deviceId, []);
    }
    this.deviceUpdateCallbacks.get(deviceId)?.push(callback);
  }

  // 移除设备更新回调
  public offDeviceUpdate(deviceId: string, callback: DeviceUpdateCallback) {
    const callbacks = this.deviceUpdateCallbacks.get(deviceId);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // 注册设备在线状态回调
  public onDeviceOnline(deviceId: string, callback: DeviceOnlineCallback) {
    if (!this.deviceOnlineCallbacks.has(deviceId)) {
      this.deviceOnlineCallbacks.set(deviceId, []);
    }
    this.deviceOnlineCallbacks.get(deviceId)?.push(callback);
  }

  // 移除设备在线状态回调
  public offDeviceOnline(deviceId: string, callback: DeviceOnlineCallback) {
    const callbacks = this.deviceOnlineCallbacks.get(deviceId);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // 获取当前状态
  public getStatus(): WebSocketStatus {
    return this.status;
  }

  // 关闭连接
  public disconnect() {
    this.cleanup();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.updateStatus(WebSocketStatus.DISCONNECTED);
  }

  // 重连
  public reconnect() {
    this.disconnect();
    setTimeout(() => {
      this.connect();
    }, 1000);
  }
}

// 创建单例
export const wsManager = new WebSocketManager();
