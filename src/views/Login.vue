<template>
  <div class="Login">
    <div class="onLogin">
      <van-cell-group inset>
        <van-field v-model="tel" type="tel" placeholder="请输入账号" />
        <van-field
          v-model="password"
          type="password"
          placeholder="请输入密码"
        />
      </van-cell-group>
    </div>
    <div class="btn">
      <van-button @click="login" type="primary" size="large">登陆</van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { userLogin } from "../api/index";
import type { LoginParams } from "../api/index.d";

const tel = ref("");
const password = ref("");

const login = async () => {
  const params: LoginParams = {
    countryCode: "+86",
    phoneNumber: "+86" + tel.value,
    password: password.value,
  };

  const result = await userLogin(params);
  console.log("登录成功:", result);
  tel.value = "";
  password.value = "";
};
</script>

<style lang="less" scoped>
.Login {
  .onLogin {
    margin-top: 100px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .btn {
    display: flex;
    justify-content: center;
    margin-top: 20px;
  }
}
</style>
