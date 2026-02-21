export interface ApiResponse<T> {
  code: number
  msg: string
  data: T
}

export interface SignInData {
  sqMsg: string
  continuousDays: number
  totalDays: string
  sqExp: number
  shopExp: number
}

export interface MySignLogRow {
  id: string
  uuid: string
  character_name: string
  area_name: string
  group_name: string
  sign_time: string
  ip_location: string
  platform: number
}

export interface MySignLogData {
  count: number
  rows: MySignLogRow[]
}

export interface SignReward {
  id: number
  begin_date: string
  end_date: string
  rule: number
  item_name: string
  item_pic: string
  num: number
  item_desc: string
  is_get: number // -1 未满足 / 0 可领取 / 1 已领取
}
