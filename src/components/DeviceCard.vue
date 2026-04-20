<template>
  <div class="device-card" :class="{ offline: !device.online }">
    <!-- 设备头部 -->
    <div class="device-header">
      <div class="device-info">
        <h3 class="device-name">
          {{ device.name }}
          <van-tag v-if="!device.online" type="danger">离线</van-tag>
          <van-tag v-else type="success">在线</van-tag>
        </h3>
      </div>
    </div>
    <!-- 开关控制区域 -->
    <div class="switch-control">
      <div
        v-for="(switchItem, index) in switches"
        :key="index"
        class="switch-item"
      >
        <div class="switch-header">
          <div class="switch-label">通道 {{ switchItem.outlet + 1 }}</div>
          <div class="switch-status">
            <span
              class="status-text"
              :class="{ on: switchItem.switch === 'on' }"
            >
              {{ switchItem.switch === "on" ? "开" : "关" }}
            </span>
          </div>
        </div>

        <div class="switch-body">
          <van-switch
            v-model="switchItem.switch"
            :loading="switchLoading[index as number]"
            :disabled="!device.online || isControlling"
            active-value="on"
            inactive-value="off"
            size="24px"
            @change="handleSwitchChange(index as number, $event)"
          />
        </div>
      </div>
    </div>

    <!-- 控制状态 -->
    <div class="control-status">
      <div v-if="isControlling" class="controlling">
        <van-loading type="spinner" size="20px" />
        <span>控制中...</span>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="device-actions">
      <van-button
        type="primary"
        size="small"
        @click="handleRefresh"
        :loading="isRefreshing"
        :disabled="!device.online"
      >
        刷新状态
      </van-button>
      <van-button
        type="success"
        size="small"
        @click="handleAllOn"
        :loading="isControlling"
        :disabled="!device.online"
      >
        全部打开
      </van-button>
      <van-button
        type="danger"
        size="small"
        @click="handleAllOff"
        :loading="isControlling"
        :disabled="!device.online"
      >
        全部关闭
      </van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { showToast, showFailToast, showSuccessToast } from "vant";
import { wsManager, WebSocketStatus } from "../api/websocket";
import type { DeviceInfo } from "../api/index.d";

// 定义 props
interface Props {
  device: DeviceInfo;
}

const props = defineProps<Props>();

// 定义 emits
const emit = defineEmits<{
  "update:device": [device: DeviceInfo];
  control: [deviceId: string, params: any];
}>();

// 响应式数据
const switchLoading = ref<boolean[]>([false, false, false, false]);
const isControlling = ref(false);
const isRefreshing = ref(false);
const lastControlTime = ref<number | null>(null);
const localSwitches = ref<any[]>([]);

// 计算属性
const switches = computed({
  get: () => {
    if (localSwitches.value.length === 4) {
      return localSwitches.value;
    }
    // 从设备参数中获取开关状态
    if (props.device.params?.switches?.length === 4) {
      return props.device.params.switches;
    }
    // 默认返回4个关闭的开关
    return Array(4)
      .fill(0)
      .map((_, index) => ({
        switch: "off" as "on" | "off",
        outlet: index,
      }));
  },
  set: (value) => {
    localSwitches.value = value;
  },
});

// 处理开关变化
const handleSwitchChange = async (index: number, value: "on" | "off") => {
  if (!props.device.online) {
    showFailToast("设备离线，无法控制");
    // 恢复原状态
    localSwitches.value = [...localSwitches.value];
    return;
  }

  // 检查 WebSocket 连接状态
  if (wsManager.getStatus() !== WebSocketStatus.CONNECTED) {
    showFailToast("WebSocket未连接，请重新连接");
    // 尝试重连
    wsManager.reconnect();
    return;
  }

  // 更新本地状态
  const newSwitches = [...localSwitches.value];
  newSwitches[index] = { ...newSwitches[index], switch: value };
  localSwitches.value = newSwitches;

  // 发送控制指令
  switchLoading.value[index] = true;
  isControlling.value = true;

  try {
    // 根据四通道插座协议，params 应该直接包含 switches 数组
    const params = {
      switches: newSwitches,
    };

    console.log("发送控制指令:", {
      deviceId: props.device.deviceid,
      params: params,
    });

    const result = await wsManager.sendControlCommand(
      props.device.deviceid,
      params,
    );

    if (result) {
      lastControlTime.value = Date.now();

      // 通知父组件设备已更新
      emit("control", props.device.deviceid, params);
    } else {
      // 控制失败，恢复原状态
      const originalSwitches = props.device.params?.switches || [];
      if (originalSwitches.length === 4) {
        localSwitches.value = [...originalSwitches];
      }
      showFailToast("控制失败");
    }
  } catch (error) {
    console.error("控制设备失败:", error);
    showFailToast("控制失败");

    // 恢复原状态
    const originalSwitches = props.device.params?.switches || [];
    if (originalSwitches.length === 4) {
      localSwitches.value = [...originalSwitches];
    }
  } finally {
    switchLoading.value[index] = false;
    isControlling.value = false;
  }
};

// 刷新设备状态
const handleRefresh = async () => {
  if (!props.device.online) {
    showFailToast("设备离线，无法刷新");
    return;
  }

  isRefreshing.value = true;
  try {
    const params = await wsManager.queryDeviceStatus(props.device.deviceid, [
      "switches",
      "configure",
      "pulses",
    ]);

    if (params && params.switches) {
      // 更新开关状态
      localSwitches.value = [...params.switches];

      // 通知父组件更新设备
      const updatedDevice = {
        ...props.device,
        params: {
          ...props.device.params,
          switches: params.switches,
          configure: params.configure,
          pulses: params.pulses,
        },
      };
      emit("update:device", updatedDevice);

      showSuccessToast("状态刷新成功");
    }
  } catch (error) {
    console.error("刷新设备状态失败:", error);
    showFailToast("刷新失败");
  } finally {
    isRefreshing.value = false;
  }
};

// 关闭所有通道
const handleAllOff = async () => {
  if (!props.device.online) {
    showFailToast("设备离线，无法控制");
    return;
  }

  isControlling.value = true;

  try {
    const allOffSwitches = localSwitches.value.map((switchItem, index) => ({
      switch: "off" as "on" | "off",
      outlet: index,
    }));

    const result = await wsManager.sendControlCommand(props.device.deviceid, {
      switches: allOffSwitches,
    });

    if (result) {
      localSwitches.value = allOffSwitches;
      showSuccessToast("已关闭所有通道");
      lastControlTime.value = Date.now();

      // 通知父组件设备已更新
      emit("control", props.device.deviceid, { switches: allOffSwitches });
    } else {
      showFailToast("控制失败");
    }
  } catch (error) {
    console.error("关闭所有通道失败:", error);
    showFailToast("控制失败");
  } finally {
    isControlling.value = false;
  }
};

// 打开所有通道
const handleAllOn = async () => {
  if (!props.device.online) {
    showFailToast("设备离线，无法控制");
    return;
  }

  isControlling.value = true;

  try {
    const allOnSwitches = localSwitches.value.map((switchItem, index) => ({
      switch: "on" as "on" | "off",
      outlet: index,
    }));

    const result = await wsManager.sendControlCommand(props.device.deviceid, {
      switches: allOnSwitches,
    });

    if (result) {
      localSwitches.value = allOnSwitches;
      showSuccessToast("已打开所有通道");
      lastControlTime.value = Date.now();

      // 通知父组件设备已更新
      emit("control", props.device.deviceid, { switches: allOnSwitches });
    } else {
      showFailToast("控制失败");
    }
  } catch (error) {
    console.error("打开所有通道失败:", error);
    showFailToast("控制失败");
  } finally {
    isControlling.value = false;
  }
};

// 初始化开关状态
const initSwitches = () => {
  if (props.device.params?.switches?.length === 4) {
    localSwitches.value = [...props.device.params.switches];
  } else {
    // 默认状态
    localSwitches.value = Array(4)
      .fill(0)
      .map((_, index) => ({
        switch: "off" as "on" | "off",
        outlet: index,
      }));
  }
};

// 注册WebSocket回调
const handleDeviceUpdate = (deviceId: string, params: any) => {
  if (deviceId === props.device.deviceid) {
    // 检查 params 格式
    if (params && params.switches) {
      // 更新本地状态
      const newSwitches = [...params.switches];

      // 检查是否有变化
      const hasChanges =
        JSON.stringify(localSwitches.value) !== JSON.stringify(newSwitches);

      if (hasChanges) {
        localSwitches.value = newSwitches;

        // 通知父组件设备已更新
        const updatedDevice = {
          ...props.device,
          params: {
            ...props.device.params,
            ...params,
          },
        };
        emit("update:device", updatedDevice);
      }
    }
  }
};

const handleDeviceOnline = (deviceId: string, online: boolean) => {
  if (deviceId === props.device.deviceid) {
    const updatedDevice = {
      ...props.device,
      online,
    };
    emit("update:device", updatedDevice);

    if (online) {
      showToast("设备已上线");
    } else {
      showToast("设备已离线");
    }
  }
};

// 监听设备变化
watch(
  () => props.device,
  () => {
    initSwitches();
  },
  { deep: true },
);

// 生命周期
onMounted(() => {
  initSwitches();

  // 注册WebSocket回调
  wsManager.onDeviceUpdate(props.device.deviceid, handleDeviceUpdate);
  wsManager.onDeviceOnline(props.device.deviceid, handleDeviceOnline);
});

onUnmounted(() => {
  // 移除WebSocket回调
  wsManager.offDeviceUpdate(props.device.deviceid, handleDeviceUpdate);
  wsManager.offDeviceOnline(props.device.deviceid, handleDeviceOnline);
});
</script>

<style lang="less" scoped>
.device-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;

  &.offline {
    opacity: 0.7;
    background-color: #f9f9f9;
  }

  .device-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid #f0f0f0;

    .device-info {
      flex: 1;

      .device-name {
        margin: 0 0 8px 0;
        font-size: 18px;
        font-weight: 600;
        color: #333;
        display: flex;
        align-items: center;
        gap: 8px;

        .van-tag {
          font-size: 12px;
          padding: 2px 6px;
        }
      }
    }
  }

  .switch-control {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;

    .switch-item {
      background: #fafafa;
      border-radius: 8px;
      padding: 16px;
      transition: all 0.3s ease;

      &:hover {
        background: #f5f5f5;
      }

      .switch-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;

        .switch-label {
          font-size: 14px;
          font-weight: 500;
          color: #333;
        }

        .switch-status {
          .status-text {
            font-size: 12px;
            padding: 2px 6px;
            border-radius: 4px;
            background-color: #f0f0f0;
            color: #666;

            &.on {
              background-color: #e6f7ff;
              color: #1890ff;
            }
          }
        }
      }

      .switch-body {
        display: flex;
        flex-direction: column;
        gap: 12px;

        .van-switch {
          align-self: flex-start;
        }
      }
    }
  }

  .control-status {
    margin-top: 20px;
    padding-top: 15px;
    border-top: 1px solid #f0f0f0;
    text-align: center;
    min-height: 20px;

    .controlling {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: #1890ff;
      font-size: 13px;

      .van-loading {
        margin: 0;
      }
    }
  }

  .device-actions {
    display: flex;
    justify-content: center;
    gap: 12px;

    .van-button {
      min-width: 100px;
    }
  }
}
</style>
