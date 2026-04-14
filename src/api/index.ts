import axios from "./axios.js";
import type { LoginParams, LoginResponse, LoginSuccessData } from "./index.d";

export const userLogin = async (
  params: LoginParams,
): Promise<LoginSuccessData> => {
  // 设置默认语言
  if (!params.lang) {
    params.lang = "en";
  }

  // 验证必要参数
  if (!params.password) {
    throw new Error("密码不能为空");
  }

  if (!params.countryCode || !params.countryCode.startsWith("+")) {
    throw new Error('国家区号格式不正确，必须以"+"开头');
  }

  // 验证邮箱和手机号至少有一个
  if (!params.email && !params.phoneNumber) {
    throw new Error("邮箱或手机号必须填写一个");
  }

  // 发送登录请求
    const response = await axios.post<LoginResponse>("/v2/user/login", params);
    
    console.log("登录响应数据:", response);

  // 登录成功，返回用户数据
  const successData = response.data as LoginSuccessData;

  // 存储token到localStorage
  if (successData.at) {
    localStorage.setItem("access_token", successData.at);
    localStorage.setItem("refresh_token", successData.rt);
    localStorage.setItem("user_region", successData.region);

    // 可以在这里存储用户信息
    if (successData.user) {
      localStorage.setItem("user_info", JSON.stringify(successData.user));
    }
  }

  return successData;
};
