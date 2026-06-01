import { useState, useCallback, useRef } from 'react';

interface UseSpeechRecognitionOptions {
  lang?: string;
  onResult?: (text: string) => void;
  onInterim?: (text: string) => void;
  continuous?: boolean;
}

export function useSpeechRecognition({ lang = 'zh-CN', onResult, onInterim, continuous = false }: UseSpeechRecognitionOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [isSupported] = useState(() => 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  const recognitionRef = useRef<any>(null);

  const start = useCallback(() => {
    if (!isSupported) return;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          // Add basic punctuation for Chinese
          let processed = transcript;
          if (lang.startsWith('zh')) {
            // Add period if sentence doesn't end with punctuation
            if (processed && !/[。！？，、；：""''（）《》.!?,]$/.test(processed)) {
              processed += '。';
            }
          }
          final += processed;
        } else {
          interim += transcript;
        }
      }

      if (final) {
        setInterimText('');
        onResult?.(final);
      }
      if (interim) {
        setInterimText(interim);
        onInterim?.(interim);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText('');
      recognitionRef.current = null;
    };

    recognition.onerror = () => {
      setIsListening(false);
      setInterimText('');
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isSupported, lang, onResult, onInterim, continuous]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimText('');
  }, []);

  const toggle = useCallback(() => {
    if (isListening) stop();
    else start();
  }, [isListening, start, stop]);

  return { isListening, isSupported, interimText, start, stop, toggle };
}
