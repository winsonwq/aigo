// 模型配置类型定义

/**
 * AI 模型配置
 */
export interface ModelConfig {
  id: string;
  name: string; // 配置名称
  base_url: string; // API Base URL
  api_key: string; // API Key
  model: string; // 模型名称
  created_at: string; // 创建时间（ISO 字符串）
  updated_at: string; // 更新时间（ISO 字符串）
}

/**
 * 模型配置存储键名
 */
export const MODELS_STORAGE_KEY = "aigo_models";

/**
 * 默认模型配置键名
 */
export const DEFAULT_MODEL_KEY = "aigo_default_model_id";
