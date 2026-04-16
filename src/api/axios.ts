import axios from "axios";

axios.defaults.baseURL = "/api";
axios.defaults.headers.post["Content-Type"] = "application/json"; // 告诉浏览器后端返回的数据格式是 json 格式

const appId = import.meta.env.VITE_APP_ID;
const appSecret = import.meta.env.VITE_APP_SECRET;

// 生成随机字符串
function generateNonce(length: number = 8): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 计算签名
async function calculateSign(params: any): Promise<string> {
  try {
    const encoder = new TextEncoder();

    const keyData = encoder.encode(appSecret);
    const messageData = encoder.encode(params);

    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", key, messageData);
    const signatureArray = new Uint8Array(signature);
    let binary = "";
    for (let i = 0; i < signatureArray.length; i++) {
      binary += String.fromCharCode(signatureArray[i]);
    }
    const base64Signature = btoa(binary);
    console.log("生成的签名:", base64Signature);
    return base64Signature;
  } catch (error) {
    console.error("签名计算失败:", error);
    throw error;
  }
}

//请求拦截器
axios.interceptors.request.use(async (req) => {
  // 添加通用请求头
  req.headers["X-CK-Appid"] = appId;
  req.headers["X-CK-Nonce"] = generateNonce();
  // 对于登录接口，需要计算签名
  if (req.url?.includes("/v2/user/login") && req.method === "post") {
    // 设置Authorization头
    const sign = await calculateSign(JSON.stringify(req.data));
    req.headers.Authorization = `Sign ${sign}`;
  } else {
    // 其他接口使用token认证
    const token = localStorage.getItem("access_token");
    if (token) {
      req.headers.Authorization = `Bearer ${token}`;
    }
  }
  return req;
});

// 响应拦截器
axios.interceptors.response.use((res) => {
  console.log("响应拦截器收到的响应:", res);
  if (res.status !== 200) {
    // 程序性错误
    return Promise.reject(res);
  } else {
    if (res.data.error !== 0) {
      // 业务错误
      return Promise.reject(res);
    }
    return res.data;
  }
});

export default axios;
