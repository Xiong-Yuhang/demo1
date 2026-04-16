<template>
  <div class="login-container">
    <!-- 背景装饰 -->
    <div class="decoration-bg"></div>

    <!-- 登录卡片 -->
    <div class="login-card">
      <!-- 顶部区域 -->
      <div class="login-header">
        <p class="welcome-text">欢迎回来，请登录您的账户</p>
      </div>

      <!-- 登录表单 -->
      <div class="login-form">
        <van-cell-group inset>
          <van-field
            v-model="tel"
            type="tel"
            placeholder="请输入手机号码"
            left-icon="phone"
            :maxlength="11"
            clearable
          />
          <van-field
            v-model="password"
            type="password"
            placeholder="请输入密码"
            left-icon="lock"
            clearable
            @keyup.enter="login"
          />
        </van-cell-group>

        <!-- 登录按钮 -->
        <div class="login-btn">
          <van-button
            @click="login"
            type="primary"
            size="large"
            round
            :loading="loading"
            :disabled="!canLogin"
          >
            {{ loading ? "登录中..." : "登录" }}
          </van-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { userLogin } from "../api/index";
import type { LoginParams } from "../api/index.d";
import router from "../router/index.ts";
import { showFailToast, showSuccessToast } from "vant";

const tel = ref("");
const password = ref("");
const loading = ref(false);

// 计算属性：是否可以登录
const canLogin = computed(() => {
  return tel.value.trim().length >= 11 && password.value.trim().length >= 6;
});

const login = async () => {
  if (!canLogin.value) {
    showFailToast("请输入正确的账号和密码");
    return;
  }

  loading.value = true;

  try {
    const params: LoginParams = {
      countryCode: "+86",
      phoneNumber: "+86" + tel.value,
      password: password.value,
    };

    const result = await userLogin(params);
    console.log("登录成功:", result);

    showSuccessToast("登录成功");

    // 清空表单
    tel.value = "";
    password.value = "";

    // 跳转到首页
    setTimeout(() => {
      router.push("/home");
    }, 800);
  } catch (error: any) {
    console.error("登录失败:", error);
    showFailToast(error.message || "登录失败，请重试");
  } finally {
    loading.value = false;
  }
};
</script>

<style lang="less" scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 20px;
  position: relative;
  overflow: hidden;

  .decoration-bg {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: radial-gradient(#1890ff22 1px, transparent 1px);
    background-size: 20px 20px;
    opacity: 0.3;
  }

  .login-card {
    background: white;
    border-radius: 20px;
    padding: 40px 30px;
    width: 100%;
    max-width: 400px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
    position: relative;
    z-index: 1;
    animation: slideUp 0.6s ease-out;

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .login-header {
      text-align: center;
      margin-bottom: 30px;

      .welcome-text {
        color: #666;
        font-size: 14px;
        margin: 0;
        opacity: 0.8;
      }
    }

    .login-form {
      .van-cell-group {
        margin-bottom: 20px;
        background: transparent;

        .van-field {
          background: #f8f9fa;
          border-radius: 12px;
          margin-bottom: 16px;
          border: 2px solid transparent;
          transition: all 0.3s ease;

          &:hover {
            background: #f0f2f5;
            border-color: #e6f7ff;
          }

          &:focus-within {
            background: white;
            border-color: #1890ff;
            box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.1);
          }

          ::v-deep(.van-field__control) {
            color: #1a1a1a;
            font-weight: 500;

            &::placeholder {
              color: #999;
              font-weight: normal;
            }
          }

          ::v-deep(.van-field__left-icon) {
            color: #1890ff;
            margin-right: 8px;
          }
        }
      }

      .login-btn {
        margin-top: 25px;

        .van-button {
          background: linear-gradient(135deg, #1890ff, #52c41a);
          border: none;
          height: 48px;
          font-size: 16px;
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(24, 144, 255, 0.3);
          transition: all 0.3s ease;

          &:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(24, 144, 255, 0.4);
          }

          &:active:not(:disabled) {
            transform: translateY(0);
            box-shadow: 0 2px 8px rgba(24, 144, 255, 0.3);
          }

          &:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
        }
      }
    }
  }
}

// 响应式调整
@media (max-width: 480px) {
  .login-container {
    padding: 15px;

    .login-card {
      padding: 30px 20px;

      .login-form {
        .login-btn {
          .van-button {
            height: 44px;
            font-size: 15px;
          }
        }
      }
    }
  }
}
</style>
