// 用户登录请求参数类型
export interface LoginParams {
  lang?: string; // 可选，默认 'en'
  countryCode: string; // 必须，电话区号，如 "+86"
  email?: string; // 可选，邮箱地址
  phoneNumber?: string; // 可选，手机号
  password: string; // 必须，密码
}

// 用户信息类型
export interface UserInfo {
  uid?: string;
  email?: string;
  phoneNumber?: string;
  [key: string]: any; // 其他可能的字段
}

// 登录成功响应数据类型
export interface LoginSuccessData {
  user: UserInfo;
  at: string; // Access Token
  rt: string; // Refresh Token
  region: string; // 用户所属区域
}

// 重定向错误响应
export interface RedirectErrorData {
  region: string;
}

// 完整响应类型
export interface ApiResponse<T = any> {
  error?: number;
  msg?: string;
  data?: T;
}

// 登录响应类型
export type LoginResponse = ApiResponse<LoginSuccessData | RedirectErrorData>;
