import axios from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import { UpscaleConfig, UpscaleResult, UpscaleOptions } from './types';

export class StabilityUpscaler {
  private apiKey: string;
  private baseUrl = 'https://api.stability.ai/v2beta/stable-image/upscale/conservative';

  constructor(config: UpscaleConfig) {
    this.apiKey = config.apiKey;
  }

  async upscaleFromFile(filePath: string, options?: UpscaleOptions): Promise<UpscaleResult> {
    try {
      console.log('Starting upscale process...');
      
      // Validate options
      if (options?.creativity !== undefined && (options.creativity < 0.2 || options.creativity > 0.5)) {
        return {
          success: false,
          error: 'Creativity must be between 0.2 and 0.5'
        };
      }

      if (options?.seed !== undefined && (options.seed < 0 || options.seed > 4294967294)) {
        return {
          success: false,
          error: 'Seed must be between 0 and 4294967294'
        };
      }

      console.log('Creating form data...');
      // Create form data with required and optional fields
      const formData = new FormData();
      formData.append('image', fs.createReadStream(filePath));
      formData.append('prompt', options?.prompt || 'an image');  // Simple default prompt

      // Optional fields
      if (options?.negative_prompt) {
        formData.append('negative_prompt', options.negative_prompt);
      }
      if (options?.seed !== undefined) {
        formData.append('seed', options.seed.toString());
      }
      if (options?.output_format) {
        formData.append('output_format', options.output_format);
      }
      if (options?.creativity !== undefined) {
        formData.append('creativity', options.creativity.toString());
      }

      console.log('Making API request to Stability AI...');
      console.log('Request URL:', this.baseUrl);
      console.log('Request headers:', {
        ...formData.getHeaders(),
        Authorization: 'Bearer [REDACTED]',
        Accept: 'image/*'
      });

      const response = await axios.post(
        this.baseUrl,
        formData,
        {
          validateStatus: undefined,
          responseType: 'arraybuffer',
          headers: {
            ...formData.getHeaders(),
            Authorization: `Bearer ${this.apiKey}`,
            Accept: 'image/*'
          },
        }
      );

      console.log('Received response from API, status:', response.status);

      if (response.status === 200) {
        console.log('Successfully received upscaled image data');
        return {
          success: true,
          data: response.data
        };
      }

      // For non-200 responses, try to parse the error message
      const errorMessage = response.data instanceof Buffer 
        ? response.data.toString()
        : 'Unknown error';

      console.error('API request failed:', response.status, errorMessage);
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorMessage}`
      };
    } catch (error) {
      console.error('Error during upscale process:', error);
      
      if (axios.isAxiosError(error)) {
        // Check for region error
        if (error.response?.data?.toString().includes('Country, region or territory not supported')) {
          return {
            success: false,
            error: 'Region not supported - VPN required'
          };
        }

        // Other API errors
        if (error.response?.data) {
          return {
            success: false,
            error: error.response.data.toString()
          };
        }
      }

      // Network or other errors
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}
