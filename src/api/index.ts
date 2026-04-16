import axios from "./axios.js";
import type {
  FamilyListData,
  FamilyListResponse,
  GetFamilyListParams,
  GetGroupListParams,
  GetThingListParams,
  GroupListData,
  GroupListResponse,
  LoginParams,
  LoginResponse,
  LoginSuccessData,
  ThingListData,
  ThingListResponse,
} from "./index.d";

// 登录接口
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

// 获取设备列表接口
export const getThingList = async (
  params: GetThingListParams = {},
): Promise<ThingListData> => {
  // 设置默认参数
  const requestParams: GetThingListParams = {
    lang: params.lang || "en",
    num: params.num || 30,
  };

  // 如果有家庭ID，则添加
  if (params.familyid) {
    requestParams.familyid = params.familyid;
  }

  // 发送GET请求
  const response = await axios.get<ThingListResponse>("/v2/device/thing", {
    params: requestParams,
  });

  console.log("设备列表响应:", response);
  return response.data as ThingListData;
};

// 获取设备群组列表接口
export const getGroupList = async (
  params: GetGroupListParams = {},
): Promise<GroupListData> => {
  // 设置默认参数
  const requestParams: GetGroupListParams = {
    lang: params.lang || "en",
  };

  // 发送GET请求
  const response = await axios.get<GroupListResponse>("/v2/device/group", {
    params: requestParams,
  });

  console.log("群组列表响应:", response);
  return response.data as GroupListData;
};

// 获取家庭列表接口
export const getFamilyList = async (
  params: GetFamilyListParams = {},
): Promise<FamilyListData> => {
  // 设置默认参数
  const requestParams: GetFamilyListParams = {
    lang: params.lang || "en",
  };

  // 发送GET请求
  const response = await axios.get<FamilyListResponse>("/v2/family", {
    params: requestParams,
  });

  console.log("家庭列表响应:", response);
  return response.data as FamilyListData;
};
