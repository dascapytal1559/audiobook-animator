export interface UpscaleConfig {
  apiKey: string;
}

export interface UpscaleResult {
  success: boolean;
  data?: Buffer;
  error?: string;
}

export interface UpscaleOptions {
  prompt?: string;  // Required, but we'll provide a default in the implementation
  negative_prompt?: string;
  seed?: number;  // 0-4294967294
  output_format?: 'jpeg' | 'png' | 'webp';
  creativity?: number;  // 0.2-0.5
} 