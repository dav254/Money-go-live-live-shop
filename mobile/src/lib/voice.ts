/**
 * VOICE — Android speech recognition + text-to-speech, no paid service.
 *
 * Speech-to-text uses the device's own `SpeechRecognizer` through
 * `expo-speech-recognition` (a native module, so it needs a dev build / EAS
 * build — it does NOT run inside Expo Go). Text-to-speech uses
 * `expo-speech`, which wraps Android's built-in TTS engine.
 *
 * Everything degrades to text: if permission is denied, the recognizer is
 * missing, or TTS has no voice, the chat still works by typing.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

export type MicPermission = 'unknown' | 'granted' | 'denied';

/** Splits at sentence/line boundaries under Android's per-utterance cap. */
export function chunkForSpeech(text: string, limit = 3_000): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    const window = rest.slice(0, limit);
    const split = Math.max(
      window.lastIndexOf('. '),
      window.lastIndexOf('\n'),
      window.lastIndexOf('! '),
      window.lastIndexOf('? '),
    );
    const cut = split > limit * 0.5 ? split + 1 : limit;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks.filter(Boolean);
}

export interface VoiceAssistant {
  listening: boolean;
  speaking: boolean;
  permission: MicPermission;
  error: string | null;
  startListening: () => Promise<void>;
  stopListening: () => void;
  speak: (text: string) => Promise<void>;
  stopSpeaking: () => Promise<void>;
  clearError: () => void;
}

/**
 * One shared voice controller. `onTranscript` receives only FINAL results, so
 * a half-recognised sentence is never inserted into a prompt unattended.
 */
export function useVoiceAssistant(options: {
  onTranscript: (text: string) => void;
  language?: string;
}): VoiceAssistant {
  const { onTranscript, language = 'en-US' } = options;
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [permission, setPermission] = useState<MicPermission>('unknown');
  const [error, setError] = useState<string | null>(null);
  const callback = useRef(onTranscript);
  // Identifies the current spoken run, so a queued chunk from an older reply
  // cannot start talking after the founder pressed STOP.
  const runRef = useRef(0);
  callback.current = onTranscript;

  useSpeechRecognitionEvent('result', (event) => {
    if (!event.isFinal) return;
    const transcript = event.results?.[0]?.transcript?.trim();
    if (transcript) callback.current(transcript);
  });

  useSpeechRecognitionEvent('error', (event) => {
    setListening(false);
    const message =
      event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? 'Microphone permission is required for voice input.'
        : event.error === 'no-speech'
          ? 'No speech was detected. Try again, or type instead.'
          : event.error === 'network'
            ? 'Speech recognition needs a network connection on this device.'
            : 'Voice input stopped unexpectedly. You can type instead.';
    setError(message);
  });

  useSpeechRecognitionEvent('end', () => setListening(false));

  useEffect(
    () => () => {
      // Leaving a screen must not leave the microphone or a voice running.
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        /* module unavailable (Expo Go) — nothing to stop */
      }
      void Speech.stop();
    },
    [],
  );

  const startListening = useCallback(async () => {
    setError(null);
    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      const granted = Boolean(result.granted);
      setPermission(granted ? 'granted' : 'denied');
      if (!granted) {
        setError('Microphone permission is required for voice input. You can still type.');
        return;
      }
      if (speaking) {
        await Speech.stop();
        setSpeaking(false);
      }
      ExpoSpeechRecognitionModule.start({
        lang: language,
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
        // Punctuation makes a dictated instruction usable without editing.
        addsPunctuation: true,
      });
      setListening(true);
    } catch {
      setError(
        'Voice input is not available in this build. It needs a development or EAS build; typing still works.',
      );
    }
  }, [language, speaking]);

  const stopListening = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      /* no-op */
    }
    setListening(false);
  }, []);

  const stopSpeaking = useCallback(async () => {
    runRef.current += 1;
    try {
      await Speech.stop();
    } finally {
      setSpeaking(false);
    }
  }, []);

  const speak = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      runRef.current += 1;
      const run = runRef.current;
      try {
        await Speech.stop();
        setSpeaking(true);

        /*
         * Android's TTS engine caps one utterance (about 4,000 characters), and
         * a technical report easily exceeds it. Speak sentence-sized chunks in
         * order; the run token makes STOP final.
         */
        const chunks = chunkForSpeech(clean);
        const next = (index: number) => {
          if (run !== runRef.current) return;
          if (index >= chunks.length) {
            setSpeaking(false);
            return;
          }
          Speech.speak(chunks[index], {
            language,
            // Slightly slower than default: technical text is dense to listen to.
            rate: 0.95,
            onDone: () => next(index + 1),
            onStopped: () => {
              if (run === runRef.current) setSpeaking(false);
            },
            onError: () => {
              if (run !== runRef.current) return;
              setSpeaking(false);
              setError('Text-to-speech failed on this device. The response is still on screen.');
            },
          });
        };
        next(0);
      } catch {
        setSpeaking(false);
        setError('Text-to-speech is not available on this device. The response is still on screen.');
      }
    },
    [language],
  );

  return {
    listening,
    speaking,
    permission,
    error,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    clearError: () => setError(null),
  };
}
