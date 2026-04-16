<template>
  <div class="Home">
    <!-- 顶部标题栏 -->
    <div class="top">
      <div class="title">设备列表</div>
      <div class="user-info" v-if="userName">欢迎，{{ userName }}</div>
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { getThingList, getFamilyList } from "../api/index";
import type { ThingListItem, DeviceInfo, FamilyInfo } from "../api/index.d";
import { showToast, showSuccessToast, showFailToast } from "vant";

const router = useRouter();

// 响应式数据
const loading = ref(false);
const apiError = ref("");
const thingListData = ref<any>(null);
const familyList = ref<FamilyInfo[]>([]);
const currentFamilyId = ref<string>("");
const pageSize = 5; // 每页显示设备数量

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
const thingList = computed(() => thingListData.value?.thingList || []);
const totalDevices = computed(() => thingListData.value?.total || 0);

// 判断是否为设备（非群组）
const isDevice = (
  thing: ThingListItem,
): thing is ThingListItem & { itemData: DeviceInfo } => {
  return thing.itemType === 1 || thing.itemType === 2;
};

// 获取设备名称
const getThingName = (thing: ThingListItem) => {
  if (isDevice(thing)) {
    return thing.itemData.name || `设备${thing.index}`;
  } else {
    return thing.itemData.name || `群组${thing.index}`;
  }
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
      num: pageSize,
    };

    const data = await getThingList(params);

    // 更新数据
    thingListData.value = data;

    if (data.thingList && data.thingList.length > 0) {
      showSuccessToast(`加载成功，共 ${data.total} 个设备`);
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

// 组件挂载时加载数据
onMounted(() => {
  // 检查是否已登录
  const token = localStorage.getItem("access_token");
  if (!token) {
    router.push("/login");
    return;
  }

  // 初始化加载
  initLoad();
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
      font-size: 14px;
      color: #666;
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

    .device-list {
      background: white;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);

      h3 {
        margin-top: 0;
        margin-bottom: 20px;
        color: #333;
        border-left: 4px solid #1989fa;
        padding-left: 12px;
      }

      .device-item {
        padding: 16px;
        margin-bottom: 16px;
        border: 1px solid #f0f0f0;
        border-radius: 8px;
        transition: all 0.3s;

        &:hover {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .device-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;

          .device-type {
            .van-tag {
              font-size: 12px;
              padding: 2px 6px;
            }
          }

          .device-status {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: #666;

            .status-dot {
              width: 8px;
              height: 8px;
              border-radius: 50%;

              &.online {
                background-color: #52c41a;
              }

              &.offline {
                background-color: #f5222d;
              }
            }
          }
        }

        .device-info {
          .device-name {
            font-size: 16px;
            font-weight: 500;
            color: #333;
            margin-bottom: 10px;
          }

          .device-details {
            .detail-item {
              display: flex;
              margin-bottom: 6px;
              font-size: 13px;

              .label {
                color: #666;
                min-width: 60px;
              }

              .value {
                color: #333;
                font-weight: 500;
                word-break: break-word;
              }

              &.shared-info {
                background-color: #f6ffed;
                padding: 4px 8px;
                border-radius: 4px;
                border-left: 3px solid #52c41a;
              }
            }
          }
        }

        .device-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 12px;

          .van-button {
            min-width: 80px;
          }
        }
      }

      .empty-state {
        text-align: center;
        padding: 40px 20px;

        p {
          margin-bottom: 15px;
          color: #999;
        }
      }
    }

    .pagination {
      background: white;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);

      .pagination-info {
        text-align: center;
        margin-bottom: 15px;
        color: #666;
        font-size: 14px;
      }

      .van-pagination {
        justify-content: center;
      }
    }

    .control-panel {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);

      .control-buttons {
        display: flex;
        justify-content: center;
        gap: 12px;

        .van-button {
          min-width: 100px;
        }
      }
    }
  }
}
</style>
