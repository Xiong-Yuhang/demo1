// 登录相关类型定义
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

// 设备相关类型定义
// 获取设备列表请求参数
export interface GetThingListParams {
  lang?: string; // 语言，cn 或 en
  familyid?: string; // 家庭 id，不填则默认为当前家庭
  num?: number; // 获取的数量，默认为 30，0 表示获取所有
  beginIndex?: number; // 从哪个序号开始获取列表数据，不填则默认为-9999999
}

// 获取群组列表请求参数
export interface GetGroupListParams {
  lang?: string; // 语言，cn 或 en
}

// 设备额外信息
export interface DeviceExtraInfo {
  model: string; // 固件名称
  ui: string; // UI 的名称
  uiid: number; // UI 的 ID
  description?: string; // 出厂信息备注，一般是订单号
  manufacturer?: string; // 制造商
  mac: string; // mac 地址
  apmac?: string; // ap mac 地址（设备热点的地址）
  modelInfo?: string; // 产品型号 ID
  brandId?: string; // 品牌 ID
  [key: string]: any; // 其他可能的字段
}

// 设备设置
export interface DeviceSettings {
  opsNotify?: number; // 操作变化是否通知用户（默认 0）0=不通知  1=通知
  opsHistory?: number; // 是否记录操作历史（默认 1）0=不记录  1=记录
  alarmNotify?: number; // 是否发送告警信息（默认 1）0=不发送  1=发送
  [key: string]: any; // 其他可能的字段
}

// 设备所属群组
export interface DeviceGroup {
  type: number; // 1 代表设备群组
  groupId: string; // 所属群组的 id
  [key: string]: any; // 其他可能的字段
}

// 分享者信息
export interface SharedByInfo {
  apikey: string; // 设备所属用户的唯一标识
  permit: number; // 用户的权限值，默认为 0
  phoneNumber?: string; // 设备所属用户手机号
  email?: string; // 设备所属用户 email
  nickname?: string; // 设备所属用户的昵称
  comment?: string; // 分享时的备注
  shareTime?: number; // GMT 标准时间，毫秒数
  [key: string]: any; // 其他可能的字段
}

// 被分享者信息
export interface ShareToInfo {
  permit: number; // 用户的权限值，默认为 0
  apikey: string; // 接收设备分享的用户账号 ID 标识
  phoneNumber?: string; // 设备所属用户手机号
  email?: string; // 设备所属用户 email
  nickname?: string; // 设备所属用户的昵称
  comment?: string; // 分享时的备注
  shareTime?: number; // GMT 标准时间，毫秒数
  [key: string]: any; // 其他可能的字段
}

// 设备家庭设置
export interface DeviceFamily {
  familyid: string; // 家庭 id
  index: number; // 设备排序号 可能存在负数
  roomid?: string; // 所属房间 id
  [key: string]: any; // 其他可能的字段
}

// 设备GSM信息
export interface GsmInfoData {
  [key: string]: any; // GSM 设备的卡状态对象
}

// 设备状态参数
export interface DeviceParams {
  [key: string]: any; // 设备的状态属性
}

// 设备基本信息
export interface DeviceInfo {
  name: string; // 设备名称
  deviceid: string; // 设备 ID
  apikey: string; // 设备所属用户的 apikey
  extra: DeviceExtraInfo; // factoryDevice 的 extra 字段中的内容
  brandName: string; // 品牌名称
  brandLogo?: string; // 品牌 Logo url
  showBrand: boolean; // 是否显示品牌
  productModel: string; // 产品型号名称
  devGroups?: DeviceGroup[]; // 设备所属的群组信息列表
  tags?: { [key: string]: any }; // 标签对象
  devConfig?: { [key: string]: any }; // 设备端配置信息
  settings?: DeviceSettings; // 用户设置
  family: DeviceFamily; // 设备的家庭设置
  sharedBy?: SharedByInfo; // 如果设备是别人分享过来的，就会有该属性
  shareTo?: ShareToInfo[]; // 被分享用户的列表
  devicekey: string; // 设备的出厂 apikey
  online: boolean; // 在线状态
  params?: DeviceParams; // 设备的状态属性
  gsmInfoData?: GsmInfoData; // GSM 设备的卡状态对象
  [key: string]: any; // 其他可能的字段
}

// 群组家庭设置
export interface GroupFamily {
  familyid: string; // 家庭 id
  index: number; // 群组排序号 可能存在负数
  roomid?: string; // 所属房间 id
  [key: string]: any; // 其他可能的字段
}

// 群组信息
export interface GroupInfo {
  id: string; // 群组 id
  name: string; // 群组名称
  mainDeviceId: string; // 群组的主设备 id
  family: GroupFamily; // 群组的家庭设置
  params?: DeviceParams; // 群组状态
  [key: string]: any; // 其他可能的字段
}

// Thing列表项
export interface ThingListItem {
  itemType: number; // item的类型 1=用户自己的设备 2=别人分享的设备 3=自己的群组
  itemData: DeviceInfo | GroupInfo; // 根据itemType有不同的结构
  index: number; // 排序号
}

// 获取设备列表响应数据
export interface ThingListData {
  thingList: ThingListItem[]; // Thing 列表
  total: number; // Thing 总数量（设备+设备群组）
}

// 获取群组列表响应数据
export interface GroupListData {
  groupList: Array<{
    itemType: number; // item 的类型，这里固定为 3
    itemData: GroupInfo; // 群组的信息
    index: number; // 排序号
  }>;
}

// 设备列表响应类型
export type ThingListResponse = ApiResponse<ThingListData>;

// 群组列表响应类型
export type GroupListResponse = ApiResponse<GroupListData>;

// 家庭相关类型定义
// 获取家庭列表请求参数
export interface GetFamilyListParams {
  lang?: string; // 语言，cn 或 en
}

// 房间信息
export interface RoomInfo {
  id: string; // 房间 id
  name: string; // 房间名称
  index: number; // 房间排序号 可能存在负数
  [key: string]: any; // 其他可能的字段
}

// 家庭信息
export interface FamilyInfo {
  id: string; // 家庭 id
  apikey: string; // 用户 apikey
  name: string; // 家庭名称
  index: number; // 家庭排序号 可能存在负数
  roomList?: RoomInfo[]; // 房间列表
  [key: string]: any; // 其他可能的字段
}

// 获取家庭列表响应数据
export interface FamilyListData {
  familyList: FamilyInfo[]; // 家庭列表
  currentFamilyId: string; // 当前所在家庭的 id
}

// 家庭列表响应类型
export type FamilyListResponse = ApiResponse<FamilyListData>;
