import { useCallback, useEffect, useRef, useState } from 'react';

interface UseSpeechRecognitionOptions {
  language?: string;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
}

interface UseSpeechRecognitionReturn {
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

// Check for SpeechRecognition support (cached at module level)
let _speechRecognitionClass: typeof SpeechRecognition | null | undefined = undefined;

const getSpeechRecognition = (): typeof SpeechRecognition | null => {
  if (_speechRecognitionClass !== undefined) return _speechRecognitionClass;
  if (typeof window === 'undefined') {
    _speechRecognitionClass = null;
    return null;
  }
  _speechRecognitionClass = window.SpeechRecognition || (window as any).webkitSpeechRecognition || null;
  console.log('[Voice] SpeechRecognition available:', !!_speechRecognitionClass);
  return _speechRecognitionClass;
};

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const { language = 'en-US', onResult, onError } = options;

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const SpeechRecognitionClass = getSpeechRecognition();
  const isSupported = SpeechRecognitionClass !== null;

  // Initialize recognition instance
  useEffect(() => {
    if (!SpeechRecognitionClass) return;

    const recognition = new SpeechRecognitionClass();
    recognition.lang = language;
    recognition.continuous = false; // One-shot mode
    recognition.interimResults = true; // Show partial results

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;

        if (result.isFinal) {
          final += text;
        } else {
          interim += text;
        }
      }

      setInterimTranscript(interim);

      if (final) {
        setTranscript((prev) => prev + final);
        onResult?.(final, true);
      } else if (interim) {
        onResult?.(interim, false);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('[Voice] onerror:', event.error);
      const errorMessages: Record<string, string> = {
        'not-allowed': 'Microphone access denied. Check browser settings.',
        'no-speech': 'No speech detected. Please try again.',
        network: 'Connection error. Check your internet.',
        'service-not-allowed': 'Speech service not available.',
        'audio-capture': 'No microphone found.',
        aborted: 'Recording was cancelled.',
      };

      const message = errorMessages[event.error] || `Error: ${event.error}`;
      setError(message);
      onError?.(message);
      setIsListening(false);
    };

    recognition.onstart = () => {
      console.log('[Voice] onstart - listening started');
      setIsListening(true);
      setError(null);
      setInterimTranscript('');
    };

    recognition.onend = () => {
      console.log('[Voice] onend - listening stopped');
      setIsListening(false);
      setInterimTranscript('');
    };

    recognition.onnomatch = () => {
      setError('Speech not recognized. Please try again.');
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [SpeechRecognitionClass, language, onResult, onError]);

  const startListening = useCallback(async () => {
    console.log('[Voice] startListening called, isSupported:', isSupported, 'ref:', !!recognitionRef.current);

    if (!recognitionRef.current || !isSupported) {
      console.log('[Voice] Not supported or no ref');
      setError('Voice input not supported in this browser');
      return;
    }

    // Try to request microphone permission, but proceed even if it fails
    // (SpeechRecognition will handle the permission prompt itself)
    try {
      console.log('[Voice] Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop());
      console.log('[Voice] Microphone permission granted');
    } catch (err) {
      console.warn('[Voice] Microphone permission check failed, proceeding anyway:', err);
      // Don't return - let SpeechRecognition try anyway
    }

    setError(null);
    setTranscript('');
    setInterimTranscript('');

    try {
      console.log('[Voice] Calling recognition.start()');
      recognitionRef.current.start();
      console.log('[Voice] start() called successfully');
    } catch (err) {
      console.error('[Voice] start() threw error:', err);
      // Handle "already started" error
      if (err instanceof Error && err.message.includes('already started')) {
        recognitionRef.current.stop();
      } else {
        setError(`Failed to start: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError(null);
  }, []);

  return {
    transcript,
    interimTranscript,
    isListening,
    isSupported,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}
