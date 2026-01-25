/**
 * Upload Service for Maven Widget
 *
 * Handles file uploads to S3 via pre-signed URLs.
 * Flow: Widget → API (get pre-signed URL) → S3 (direct upload)
 */

import type { FileAttachmentRef } from '../types';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_MIME_TYPES = new Set([
  // Images - Claude vision support
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  // Documents - Read tool support
  'application/pdf',
  'text/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

// Human-readable type descriptions for error messages
const TYPE_DESCRIPTIONS: Record<string, string> = {
  'image/png': 'PNG image',
  'image/jpeg': 'JPEG image',
  'image/gif': 'GIF image',
  'image/webp': 'WebP image',
  'application/pdf': 'PDF document',
  'text/csv': 'CSV file',
  'text/plain': 'Text file',
  'application/vnd.ms-excel': 'Excel file (.xls)',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel file (.xlsx)',
};

export interface UploadProgress {
  percent: number;
  loaded: number;
  total: number;
}

export interface UploadError {
  code: 'INVALID_TYPE' | 'FILE_TOO_LARGE' | 'UPLOAD_FAILED' | 'NETWORK_ERROR';
  message: string;
}

/**
 * Validate a file before upload
 * @returns Error message if invalid, null if valid
 */
export function validateFile(file: File): string | null {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    const allowedTypes = Array.from(ALLOWED_MIME_TYPES)
      .map(t => TYPE_DESCRIPTIONS[t] || t)
      .join(', ');
    return `Unsupported file type "${file.type}". Allowed: ${allowedTypes}`;
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return `File too large (${sizeMB}MB). Maximum size is 10MB.`;
  }

  return null;
}

/**
 * Check if a file is an image type (for preview generation)
 */
export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * Get file icon based on MIME type
 */
export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType === 'text/csv' || mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
  if (mimeType === 'text/plain') return '📝';
  return '📎';
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export class UploadService {
  private apiUrl: string;
  private tenantSlug: string;
  private getToken?: () => Promise<string>;

  constructor(
    apiUrl: string,
    tenantSlug: string,
    getToken?: () => Promise<string>
  ) {
    this.apiUrl = apiUrl;
    this.tenantSlug = tenantSlug;
    this.getToken = getToken;
  }

  /**
   * Get a pre-signed upload URL from the API
   */
  private async getUploadUrl(
    filename: string,
    contentType: string,
    sizeBytes: number,
    sessionId?: string
  ): Promise<{ uploadUrl: string; s3Key: string; expiresAt: string }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.getToken) {
      try {
        const token = await this.getToken();
        headers['Authorization'] = `Bearer ${token}`;
      } catch (e) {
        console.warn('[UploadService] Failed to get auth token:', e);
      }
    }

    const response = await fetch(
      `${this.apiUrl}/api/widget/${this.tenantSlug}/upload`,
      {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ filename, contentType, sizeBytes, sessionId }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `Upload failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Upload file directly to S3 using pre-signed URL
   */
  private uploadToS3(
    file: File,
    uploadUrl: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress({
            percent: Math.round((e.loaded / e.total) * 100),
            loaded: e.loaded,
            total: e.total,
          });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`S3 upload failed: ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.ontimeout = () => reject(new Error('Upload timed out'));

      // 5 minute timeout (matches pre-signed URL expiry)
      xhr.timeout = 5 * 60 * 1000;

      xhr.send(file);
    });
  }

  /**
   * Upload a file attachment
   *
   * @param file - The file to upload
   * @param sessionId - Optional session ID for organizing uploads
   * @param onProgress - Progress callback
   * @returns FileAttachmentRef with S3 key
   */
  async uploadAttachment(
    file: File,
    sessionId?: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<FileAttachmentRef> {
    // Validate file first
    const validationError = validateFile(file);
    if (validationError) {
      throw new Error(validationError);
    }

    // Get pre-signed URL
    const { uploadUrl, s3Key } = await this.getUploadUrl(
      file.name,
      file.type,
      file.size,
      sessionId
    );

    // Upload to S3
    await this.uploadToS3(file, uploadUrl, onProgress);

    // Return reference
    return {
      id: crypto.randomUUID(),
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      s3Key,
    };
  }

  /**
   * Create a preview URL for an image file
   * Returns a data URL that can be used in img src
   */
  static createPreviewUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!isImageFile(file.type)) {
        reject(new Error('Not an image file'));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }
}
