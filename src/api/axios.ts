import axios from "axios";
import router from "../router/index.ts";

axios.defaults.baseURL = "https://cn-apia.coolkit.cn";
axios.defaults.headers.post["Content-Type"] = "application/json"; // 告诉浏览器后端返回的数据格式是 json 格式

//请求拦截器
axios.interceptors.request.use((req) => {
  let token = localStorage.getItem("token");
  if (token) {
    req.headers.Authorization = token;
  }
  return req;
});

// 响应拦截器
axios.interceptors.response.use((res) => {
  if (res.status !== 200) {
    // 程序性错误
    return Promise.reject(res);
  } else {
    if (res.data.code === 401) {
      // 没有登录
      router.push("/login"); // 跳转到登录页
      return Promise.reject(res);
    }

    if (res.data.code !== 200) {
      // 业务错误
      return Promise.reject(res);
    }

    return res.data;
  }
});

export default axios;
