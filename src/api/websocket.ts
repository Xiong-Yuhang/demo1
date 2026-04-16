import { showFailToast, showToast } from "vant";

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
  private reconnectTimer: number | null = null;
  private heartbeatInterval: number = 90; // 默认心跳间隔
  private appId: string = import.meta.env.VITE_APP_ID;
  private deviceUpdateCallbacks: Map<string, DeviceUpdateCallback[]> =
    new Map();
  private deviceOnlineCallbacks: Map<string, DeviceOnlineCallback[]> =
    new Map();
  private messageHandlers: Map<string, (message: WebSocketMessage) => void> =
    new Map();
  private sequenceCallbacks: Map<string, (message: WebSocketMessage) => void> =
    new Map();

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

    this.ws.onopen = () => {
      console.log("WebSocket 连接已建立");
      this.handleOpen();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event);
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket 错误:", error);
      this.handleError();
    };

    this.ws.onclose = (event) => {
      console.log("WebSocket 连接关闭:", event.code, event.reason);
      this.handleClose(event);
    };
  }

  // 连接建立后的处理
  private async handleOpen() {
    try {
      // 发送握手认证消息
      const handshakeSuccess = await this.sendHandshake();
      if (handshakeSuccess) {
        this.updateStatus(WebSocketStatus.CONNECTED);
        showToast("WebSocket连接成功");
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

          // 修改匹配逻辑：通过 sequence 字段匹配
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

      // 设置超时
      setTimeout(() => {
        this.ws?.removeEventListener("message", messageHandler);
        console.error("握手认证超时，当前WebSocket状态:", this.ws?.readyState);
        resolve(false);
      }, 8000); // 延长超时时间
    });
  }
  // 设置心跳
  private setupHeartbeat(interval: number) {
    this.heartbeatInterval = interval;

    // 清除现有的定时器
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
    }

    // 计算心跳间隔（减去7秒，并添加随机性）
    const heartbeatTime = Math.max((this.heartbeatInterval - 7) * 1000, 10000); // 最小10秒
    const randomTime = heartbeatTime * (0.8 + Math.random() * 0.2);

    console.log("设置心跳间隔:", randomTime, "ms");

    this.pingTimer = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ action: "ping" }));
          console.log("发送心跳");
        } catch (error) {
          console.error("发送心跳失败:", error);
          this.reconnect();
        }
      } else {
        console.log("WebSocket 未连接，停止心跳");
        this.cleanup();
      }
    }, randomTime);
  }

  // 处理接收到的消息
  private handleMessage(event: MessageEvent) {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
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
        } else if (message.action !== "pong") {
          console.log("未处理的消息类型:", message.action);
        }
      } else if (message.error !== undefined) {
        console.log("收到无action的响应消息:", message);
      } else {
        console.log("未知格式的消息:", message);
      }
    } catch (error) {
      console.error("解析WebSocket消息失败:", error, event.data);
    }
  }

  // 处理update消息（设备状态更新）
  private handleUpdateMessage(message: WebSocketMessage) {
    if (message.error === 0 && message.deviceid && message.params) {
      const callbacks = this.deviceUpdateCallbacks.get(message.deviceid) || [];
      callbacks.forEach((callback) => {
        callback(message.deviceid!, message.params);
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
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // 清理所有 sequence 回调
    this.sequenceCallbacks.clear();
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
