import { useCallback, useEffect, useRef, useState } from 'react';

interface SerialPortLike {
  open: (options: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
}

interface NavigatorWithSerial extends Navigator {
  serial?: {
    requestPort: () => Promise<SerialPortLike>;
  };
}

export interface UseWebSerialOptions {
  baudRate?: number;
  onLine: (line: string) => void;
  onSystemMessage: (msg: string) => void;
}

export function useWebSerial({ baudRate = 115200, onLine, onSystemMessage }: UseWebSerialOptions) {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const portRef = useRef<SerialPortLike | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const readableClosedRef = useRef<Promise<void> | null>(null);
  const onLineRef = useRef(onLine);
  const onSysRef = useRef(onSystemMessage);

  useEffect(() => {
    onLineRef.current = onLine;
    onSysRef.current = onSystemMessage;
  }, [onLine, onSystemMessage]);

  useEffect(() => {
    const nav = navigator as NavigatorWithSerial;
    setIsSupported(Boolean(nav && 'serial' in nav && nav.serial));
  }, []);

  const disconnect = useCallback(async () => {
    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
        readerRef.current = null;
      }
      if (readableClosedRef.current) {
        await readableClosedRef.current.catch(() => {});
        readableClosedRef.current = null;
      }
      if (portRef.current) {
        await portRef.current.close();
        portRef.current = null;
      }
    } catch {
      // Ignore stream cancellation noise on close
    } finally {
      setIsConnected(false);
      setIsConnecting(false);
      onSysRef.current('تم فصل الاتصال بمنفذ الأردوينو (Serial Disconnected).');
    }
  }, []);

  const connect = useCallback(async () => {
    const nav = navigator as NavigatorWithSerial;
    setErrorMessage(null);

    if (!nav.serial) {
      const msg =
        'واجهة Web Serial غير مدعومة في هذا المتصفح أو البيئة الحالية. استخدم Chrome/Edge أو فعّل وضع المحاكاة.';
      setErrorMessage(msg);
      onSysRef.current(msg);
      return false;
    }

    setIsConnecting(true);
    try {
      const port = await nav.serial.requestPort();
      await port.open({ baudRate });
      portRef.current = port;
      setIsConnected(true);
      setIsConnecting(false);
      const transportLabel =
        baudRate === 9600 ? 'بلوتوث HC-05/HC-06' : 'كابل USB';
      onSysRef.current(
        `تم الاتصال بالأردوينو بنجاح (${transportLabel}) على سرعة ${baudRate} baud.`
      );

      if (port.readable) {
        const textDecoder = new TextDecoderStream();
        readableClosedRef.current = port.readable.pipeTo(
          textDecoder.writable as unknown as WritableStream<Uint8Array>
        );
        const reader = textDecoder.readable.getReader();
        readerRef.current = reader;

        let buffer = '';
        void (async () => {
          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              if (value) {
                buffer += value;
                const lines = buffer.split(/\r?\n/);
                buffer = lines.pop() ?? '';
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (trimmed) onLineRef.current(trimmed);
                }
              }
            }
          } catch (err) {
            if (portRef.current) {
              const msg = err instanceof Error ? err.message : 'انقطع بث المنفذ التسلسلي';
              onSysRef.current(`تنبيه تسلسلي: ${msg}`);
            }
          } finally {
            setIsConnected(false);
          }
        })();
      }
      return true;
    } catch (err) {
      setIsConnecting(false);
      setIsConnected(false);
      const rawMsg = err instanceof Error ? err.message : String(err);
      if (rawMsg.includes('No port selected')) {
        onSysRef.current('تم إلغاء اختيار منفذ الأردوينو.');
        return false;
      }
      const friendly =
        rawMsg.includes('permissions policy') || rawMsg.includes('SecurityError')
          ? 'تم تقييد منفذ Web Serial داخل الإطار المضمن. افتح التطبيق بنافذة مستقلة أو استخدم وضع المحاكاة.'
          : `تعذر الاتصال بالأردوينو: ${rawMsg}`;
      setErrorMessage(friendly);
      onSysRef.current(friendly);
      return false;
    }
  }, [baudRate]);

  const sendCommand = useCallback(async (text: string) => {
    const port = portRef.current;
    if (!port || !port.writable) return false;
    try {
      const encoder = new TextEncoder();
      const writer = port.writable.getWriter();
      await writer.write(encoder.encode(`${text}\n`));
      writer.releaseLock();
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    return () => {
      void disconnect();
    };
  }, [disconnect]);

  return {
    isSupported,
    isConnected,
    isConnecting,
    errorMessage,
    clearError: () => setErrorMessage(null),
    connect,
    disconnect,
    sendCommand,
  };
}
