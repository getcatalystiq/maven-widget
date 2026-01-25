import { useCallback, useRef, useState } from 'react';

interface UseCameraCaptureReturn {
  isSupported: boolean;
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  facingMode: 'user' | 'environment';
  openCamera: () => Promise<void>;
  capturePhoto: () => File | null;
  closeCamera: () => void;
  flipCamera: () => void;
}

// Check for getUserMedia support
const isMediaDevicesSupported = (): boolean => {
  return !!(
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia
  );
};

export function useCameraCapture(): UseCameraCaptureReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  const isSupported = isMediaDevicesSupported();

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const openCamera = useCallback(async () => {
    if (!isSupported) {
      setError('Camera not supported in this browser');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('[Camera] Requesting camera access, facingMode:', facingMode);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      console.log('[Camera] Camera access granted');

      // Stop any existing stream
      stopStream();
      streamRef.current = stream;

      // Attach stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsOpen(true);
    } catch (err) {
      console.error('[Camera] Error:', err);

      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Camera access denied. Check browser settings.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('No camera detected on this device.');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setError('Camera is in use by another application.');
        } else if (err.name === 'OverconstrainedError') {
          setError('Camera does not meet requirements.');
        } else {
          setError(`Failed to start camera: ${err.message}`);
        }
      } else {
        setError('Failed to start camera');
      }
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, facingMode, stopStream]);

  const closeCamera = useCallback(() => {
    console.log('[Camera] Closing camera');
    stopStream();

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsOpen(false);
    setError(null);
  }, [stopStream]);

  const capturePhoto = useCallback((): File | null => {
    if (!videoRef.current || !canvasRef.current || !isOpen) {
      console.warn('[Camera] Cannot capture - camera not ready');
      return null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('[Camera] Cannot get canvas context');
      return null;
    }

    // Draw video frame to canvas
    // Mirror horizontally if using front camera
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const byteString = atob(dataUrl.split(',')[1]);
    const mimeType = 'image/jpeg';
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);

    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }

    const blob = new Blob([ab], { type: mimeType });

    // Create File object
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `photo-${timestamp}.jpg`;

    const file = new File([blob], filename, { type: mimeType });

    console.log('[Camera] Photo captured:', filename, file.size, 'bytes');

    return file;
  }, [isOpen, facingMode]);

  const flipCamera = useCallback(() => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    console.log('[Camera] Flipping camera to:', newMode);
    setFacingMode(newMode);

    // If camera is open, restart with new facing mode
    if (isOpen) {
      closeCamera();
      // Re-open with slight delay to allow cleanup
      setTimeout(() => {
        openCamera();
      }, 100);
    }
  }, [facingMode, isOpen, closeCamera, openCamera]);

  return {
    isSupported,
    isOpen,
    isLoading,
    error,
    videoRef,
    canvasRef,
    facingMode,
    openCamera,
    capturePhoto,
    closeCamera,
    flipCamera,
  };
}
