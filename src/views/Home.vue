<template>
  <div class="Home">
    <!-- 顶部标题栏 -->
    <div class="top">
      <div class="title">设备列表</div>
      <div class="user-info">
        <span v-if="userName">欢迎，{{ userName }}</span>
        <van-button
          type="default"
          size="mini"
          @click="showLogoutConfirm"
          style="margin-left: 10px"
        >
          退出
        </van-button>
      </div>
    </div>

    <!-- WebSocket连接状态 -->
    <div v-if="wsStatus !== 'connected'" class="ws-warning">
      <van-tag v-if="wsStatus === 'connecting'" type="primary"
        >正在连接WebSocket...</van-tag
      >
      <van-tag v-else-if="wsStatus === 'error'" type="danger"
        >WebSocket连接失败</van-tag
      >
      <van-tag v-else type="warning">WebSocket未连接</van-tag>
    </div>

    <!-- 接口错误提示 -->
    <div v-if="apiError" class="api-error">
      <van-tag type="danger">接口错误</van-tag>
      <span>{{ apiError }}</span>
      <van-button @click="loadDeviceList" size="mini" style="margin-left: 10px">
        重试
      </van-button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading">
      <van-loading type="spinner" size="24px">加载中...</van-loading>
    </div>

    <!-- 内容区域 -->
    <div v-else class="content">
      <!-- 设备统计信息 -->
      <div v-if="!apiError && thingListData" class="stats-card">
        <div class="stat-item">
          <div class="stat-number">{{ totalDevices }}</div>
          <div class="stat-label">设备总数</div>
        </div>
      </div>

      <!-- 设备卡片 -->
      <div v-if="fourChannelDevice" class="device-card-container">
        <DeviceCard
          :device="fourChannelDevice"
          @update:device="handleDeviceUpdate"
          @control="handleDeviceControl"
        />
      </div>

      <!-- 无设备提示 -->
      <div v-else-if="!loading && !fourChannelDevice" class="empty-state">
        <van-empty image="search" description="未找到四通道设备">
          <van-button
            round
            type="primary"
            @click="loadDeviceList"
            :loading="loading"
          >
            刷新设备列表
          </van-button>
        </van-empty>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { getThingList, getFamilyList } from "../api/index";
import { wsManager, WebSocketStatus } from "../api/websocket";
import DeviceCard from "../components/DeviceCard.vue";
import type { ThingListItem, DeviceInfo, FamilyInfo } from "../api/index.d";
import {
  showToast,
  showSuccessToast,
  showFailToast,
  showConfirmDialog,
} from "vant";

const router = useRouter();

// 响应式数据
const loading = ref(false);
const apiError = ref("");
const thingListData = ref<any>(null);
const familyList = ref<FamilyInfo[]>([]);
const currentFamilyId = ref<string>("");
const wsStatus = ref<WebSocketStatus>(WebSocketStatus.DISCONNECTED);

// 显示退出确认弹窗
const showLogoutConfirm = () => {
  showConfirmDialog({
    title: "退出登录",
    message: "确定要退出登录吗？",
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    theme: "round-button",
  })
    .then(() => {
      // 用户点击确定
      logout();
    })
    .catch(() => {
      // 用户点击取消
      console.log("取消退出");
    });
};

// 从本地存储获取用户名
const userName = computed(() => {
  const userInfo = localStorage.getItem("user_info");
  if (userInfo) {
    try {
      const user = JSON.parse(userInfo);
      return user.email || user.phoneNumber || "用户";
    } catch (e) {
      return "用户";
    }
  }
  return "用户";
});

// 计算属性
const totalDevices = computed(() => thingListData.value?.total || 0);
// 四通道设备
const fourChannelDevice = computed(() => {
  if (!thingListData.value?.thingList) return null;

  const deviceItem = thingListData.value.thingList.find(
    (item: ThingListItem) => {
      if (item.itemType === 1 || item.itemType === 2) {
        const device = item.itemData as DeviceInfo;
        return device.extra?.uiid === 4; // UIID4 是四通道插座
      }
      return false;
    },
  );

  return deviceItem ? (deviceItem.itemData as DeviceInfo) : null;
});

// 初始化WebSocket
const initWebSocket = async () => {
  if (!fourChannelDevice.value) {
    console.log("没有找到四通道设备，等待设备加载...");
    return;
  }

  wsStatus.value = WebSocketStatus.CONNECTING;

  try {
    const connected = await wsManager.connect();
    if (connected) {
      // 查询设备初始状态
      if (fourChannelDevice.value) {
        setTimeout(() => {
          queryDeviceStatus(fourChannelDevice.value!.deviceid);
        }, 1000);
      }
    } else {
      wsStatus.value = WebSocketStatus.ERROR;
      showFailToast("WebSocket连接失败");
    }
  } catch (error) {
    console.error("WebSocket连接失败:", error);
    wsStatus.value = WebSocketStatus.ERROR;
    showFailToast("WebSocket连接失败");
  }
};

// 查询设备状态
const queryDeviceStatus = async (deviceId: string) => {
  if (!deviceId || wsManager.getStatus() !== WebSocketStatus.CONNECTED) {
    return;
  }

  try {
    const params = await wsManager.queryDeviceStatus(deviceId, [
      "switches",
      "configure",
      "pulses",
    ]);
    console.log("查询到的设备状态:", params);

    if (params && fourChannelDevice.value) {
      // 更新设备状态
      handleDeviceUpdate({
        ...fourChannelDevice.value,
        params: {
          ...fourChannelDevice.value.params,
          ...params,
        },
      });
    }
  } catch (error) {
    console.error("查询设备状态失败:", error);
  }
};

// 处理设备状态更新
const handleDeviceUpdate = (device: DeviceInfo) => {
  if (!thingListData.value?.thingList) {
    return;
  }

  // 更新设备列表中的设备状态
  const updatedThingList = thingListData.value.thingList.map(
    (item: ThingListItem) => {
      if (
        (item.itemType === 1 || item.itemType === 2) &&
        (item.itemData as DeviceInfo).deviceid === device.deviceid
      ) {
        return {
          ...item,
          itemData: device,
        };
      }
      return item;
    },
  );

  thingListData.value = {
    ...thingListData.value,
    thingList: updatedThingList,
  };
};

// 处理设备控制
const handleDeviceControl = (deviceId: string, params: any) => {
  console.log("设备控制指令:", deviceId, params);
  // 这里可以添加额外的控制逻辑
};

// 加载家庭列表
const loadFamilyList = async () => {
  try {
    const data = await getFamilyList({ lang: "cn" });
    familyList.value = data.familyList;

    if (data.familyList.length > 0) {
      // 使用当前家庭ID，如果没有则使用第一个家庭
      currentFamilyId.value = data.currentFamilyId || data.familyList[0].id;
      console.log("当前家庭ID:", currentFamilyId.value);
      return true;
    } else {
      apiError.value = "没有找到家庭信息";
      return false;
    }
  } catch (err: any) {
    console.error("加载家庭列表失败:", err);
    apiError.value = "加载家庭列表失败: " + (err.message || "未知错误");
    return false;
  }
};

// 加载设备列表
const loadDeviceList = async () => {
  if (!currentFamilyId.value) {
    showFailToast("请先选择家庭");
    return;
  }

  loading.value = true;
  apiError.value = "";

  try {
    // 构建请求参数
    const params = {
      lang: "cn",
      familyid: currentFamilyId.value,
      num: 0, // 获取所有设备
    };

    const data = await getThingList(params);

    // 更新数据
    thingListData.value = data;

    if (data.thingList && data.thingList.length > 0) {
      showSuccessToast(`加载成功，共 ${data.total} 个设备`);

      // 找到四通道设备后，初始化WebSocket连接
      if (fourChannelDevice.value) {
        console.log(
          "找到四通道设备，初始化WebSocket连接:",
          fourChannelDevice.value.deviceid,
        );
        initWebSocket();
      }
    } else {
      showToast("该家庭暂无设备");
    }
  } catch (err: any) {
    console.error("加载设备列表失败:", err);

    // 处理不同类型的错误
    if (err?.error === 407) {
      apiError.value =
        "接口权限不足 (错误码: 407)。请确保您的 appid 有访问 /v2/device/thing 接口的权限。";
    } else if (err?.error === 401) {
      apiError.value = "认证失败，请重新登录";
      // 认证失败，跳转到登录页
      setTimeout(() => {
        logout();
      }, 2000);
    } else if (err?.response?.status === 404) {
      apiError.value = "接口不存在 (404)。请检查接口地址是否正确。";
    } else if (err?.response?.status === 500) {
      apiError.value = "服务器内部错误 (500)。请稍后重试。";
    } else if (err.message && err.message.includes("Network Error")) {
      apiError.value = "网络连接失败。请检查网络连接。";
    } else {
      apiError.value = err.message || "加载失败，请重试";
    }

    showFailToast(apiError.value);
  } finally {
    loading.value = false;
  }
};

// 退出登录
const logout = () => {
  // 清除本地存储的token
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user_region");
  localStorage.removeItem("user_info");

  // 断开WebSocket连接
  wsManager.disconnect();

  // 跳转到登录页
  router.push("/login");
};

// 初始化加载
const initLoad = async () => {
  loading.value = true;
  try {
    // 先加载家庭列表
    const familyLoaded = await loadFamilyList();

    if (familyLoaded) {
      // 再加载设备列表
      await loadDeviceList();
    }
  } catch (err) {
    console.error("初始化加载失败:", err);
  } finally {
    loading.value = false;
  }
};

// 监听WebSocket状态变化
wsManager.onStatusChange = (status: WebSocketStatus) => {
  wsStatus.value = status;
};

// 组件挂载时加载数据
onMounted(() => {
  // 检查是否已登录
  const token = localStorage.getItem("access_token");
  if (!token) {
    showFailToast("未登录，请先登录");
    router.push("/login");
    return;
  }

  // 初始化加载
  initLoad();
});

// 组件卸载时清理
onUnmounted(() => {
  wsManager.disconnect();
});
</script>

<style lang="less" scoped>
.Home {
  padding: 20px;
  min-height: 100vh;
  background-color: #f5f5f5;

  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid #e0e0e0;

    .title {
      font-size: 24px;
      font-weight: bold;
      color: #333;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 14px;
      color: #666;
    }
  }

  .ws-warning {
    margin-bottom: 15px;
    text-align: center;

    .van-tag {
      font-size: 12px;
      padding: 4px 8px;
    }
  }

  .api-error {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 15px;
    margin-bottom: 15px;
    background-color: #fff2f0;
    color: #f5222d;
    border: 1px solid #ffccc7;
    border-radius: 8px;
    font-size: 14px;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    font-size: 16px;
    color: #666;

    .van-loading {
      margin-bottom: 10px;
    }
  }

  .content {
    .stats-card {
      display: flex;
      justify-content: space-around;
      background: white;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);

      .stat-item {
        display: flex;
        flex-direction: column;
        align-items: center;

        .stat-number {
          font-size: 24px;
          font-weight: bold;
          color: #1890ff;
          margin-bottom: 5px;
        }

        .stat-label {
          font-size: 12px;
          color: #999;
        }
      }
    }

    .device-card-container {
      margin-bottom: 20px;
    }

    .empty-state {
      background: white;
      border-radius: 12px;
      padding: 40px 20px;
      text-align: center;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }
  }
}
</style>
