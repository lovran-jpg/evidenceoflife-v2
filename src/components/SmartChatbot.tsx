import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Mic, MicOff, X, Loader2, ArrowRight, ChevronDown, ChevronUp, Check, Plus, Calendar, Repeat, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { useLanguage } from '@/hooks/useLanguage';

interface SmartInputResult {
  type: 'recap' | 'plan' | 'due';
  title: string;
  original_text?: string;
  tags: string[];
  emoji?: string;
  time_segment?: string;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  due_date?: string;
  is_habit?: boolean;
}

interface ParsedItem {
  id: string;
  result: SmartInputResult;
  editedTitle: string;
  editedOriginal?: string;
  confirmed: boolean;
}

interface ConversationEntry {
  userText: string;
  result?: SmartInputResult;
}

// Unified chat message for proper interleaving
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  userText?: string;
  item?: ParsedItem;
  queryAnswer?: string;
}

const FILLER_WORDS_RE = /[，。]?\s*(?:嗯|啊|呃|ne|那个|就是说|就是|然后呢|然后|好的|对的|对|额|哦|哎|呢)+[，。]?\s*/gi;

function cleanFillerWords(text: string): string {
  return text.replace(FILLER_WORDS_RE, '').replace(/\s{2,}/g, ' ').trim();
}

interface SmartChatbotProps {
  onAddMoment: (data: {
    text?: string;
    emoji?: string;
    photos: string[];
    links?: import('@/types').MomentLinkPreview[];
    tags?: string[];
  }) => void;
  onAddTodo: (title: string, timeSegment: string) => void;
  onAddDue?: (title: string, dueDate?: string, isHabit?: boolean) => void;
  selectedDate: string;
  todayEvents?: { time: string; title: string; duration?: string }[];
}

export function SmartChatbot({ onAddMoment, onAddTodo, onAddDue, selectedDate, todayEvents }: SmartChatbotProps) {
  const { t } = useLanguage();
  const [active, setActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showOriginalId, setShowOriginalId] = useState<string | null>(null);
  const [dueDateDrafts, setDueDateDrafts] = useState<Record<string, string>>({});
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const accumulatedRef = useRef('');
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationHistoryRef = useRef<ConversationEntry[]>([]);
  const isSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatMessages, loading, interimText]);

  // Helper to get all items from chat messages
  const allItems = useMemo(() => chatMessages.filter(m => m.item).map(m => m.item!), [chatMessages]);
  const unconfirmedCount = allItems.filter(i => !i.confirmed).length;

  const updateItem = useCallback((itemId: string, updater: (item: ParsedItem) => ParsedItem) => {
    setChatMessages(prev => prev.map(m => {
      if (m.item?.id === itemId) return { ...m, item: updater(m.item) };
      return m;
    }));
  }, []);

  const classify = useCallback(async (text: string) => {
    if (!text.trim()) return;

    // Add user message
    const userMsgId = crypto.randomUUID();
    setChatMessages(prev => [...prev, { id: userMsgId, role: 'user', userText: text.trim() }]);

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('smart-input', {
        body: {
          text: text.trim(),
          currentDate: selectedDate,
          currentTime: format(new Date(), 'HH:mm'),
          conversationHistory: conversationHistoryRef.current.slice(-6),
          todayEvents: todayEvents || [],
        },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); setLoading(false); return; }

      const action = data?._action || 'classify';
      const assistantMsgId = crypto.randomUUID();

      if (action === 'query') {
        setChatMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', queryAnswer: data.answer }]);
        conversationHistoryRef.current.push({ userText: text.trim() });
      } else if (action === 'modify') {
        const target = data.target;
        const updates = data.updates || {};
        setChatMessages(prev => {
          const unconfirmedItems = prev.filter(m => m.item && !m.item.confirmed);
          if (unconfirmedItems.length === 0) return prev;
          
          let targetMsg: ChatMessage | undefined;
          if (target === 'last') {
            targetMsg = unconfirmedItems[unconfirmedItems.length - 1];
          } else if (data.target_title) {
            targetMsg = unconfirmedItems.find(m => 
              m.item!.editedTitle.includes(data.target_title) || m.item!.result.title.includes(data.target_title)
            );
          }
          if (!targetMsg) targetMsg = unconfirmedItems[unconfirmedItems.length - 1];
          
          return prev.map(m => {
            if (m.id !== targetMsg!.id || !m.item) return m;
            const updatedResult = { ...m.item.result };
            if (updates.title) updatedResult.title = updates.title;
            if (updates.start_time) updatedResult.start_time = updates.start_time;
            if (updates.end_time) updatedResult.end_time = updates.end_time;
            if (updates.duration_minutes) updatedResult.duration_minutes = updates.duration_minutes;
            if (updates.tags) updatedResult.tags = updates.tags;
            return { ...m, item: { ...m.item, result: updatedResult, editedTitle: updates.title || m.item.editedTitle } };
          });
        });
        toast.success('已更新 ✨');
        conversationHistoryRef.current.push({ userText: text.trim() });
      } else {
        // Standard classify
        const r = data as SmartInputResult;
        if (!r.original_text) r.original_text = text.trim();
        // Clean filler words from original_text
        if (r.original_text) r.original_text = cleanFillerWords(r.original_text);

        const newItem: ParsedItem = {
          id: crypto.randomUUID(),
          result: r,
          editedTitle: r.title,
          editedOriginal: r.original_text,
          confirmed: false,
        };
        setChatMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', item: newItem }]);
        conversationHistoryRef.current.push({ userText: text.trim(), result: r });
      }
    } catch (e) {
      console.error('Smart input error:', e);
      toast.error('AI 分类失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, todayEvents]);

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setInterimText('');
    const text = accumulatedRef.current;
    if (text.trim()) {
      classify(text);
      accumulatedRef.current = '';
    }
  }, [classify]);

  const startListening = useCallback(() => {
    if (!isSupported) { toast.error('你的浏览器不支持语音识别'); return; }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;
    // No maxAlternatives limit — allow unlimited speech duration

    accumulatedRef.current = '';

    recognition.onresult = (event: any) => {
      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          let processed = t;
          if (!/[。！？，、；：""''（）《》.!?,]$/.test(processed)) processed += '。';
          finalText += processed;
        } else {
          interim += t;
        }
      }
      if (finalText) {
        accumulatedRef.current += finalText;
        setInterimText('');
        // Reset silence timer — auto-stop after 5 seconds of silence (was 2s, now more generous)
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          stopListening();
        }, 5000);
      }
      if (interim) {
        setInterimText(accumulatedRef.current + interim);
        // Keep resetting silence timer while user is speaking
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          stopListening();
        }, 5000);
      }
    };

    recognition.onend = () => {
      // If there's accumulated text and we didn't manually stop, auto-restart to allow unlimited speaking
      if (accumulatedRef.current && recognitionRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          // If restart fails, just stop
        }
      }
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onerror = (e: any) => {
      // 'no-speech' is not fatal — just keep listening
      if (e.error === 'no-speech') return;
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isSupported, stopListening]);

  const handleMicClick = useCallback(() => {
    if (!active) {
      setActive(true);
      setChatMessages([]);
      setInterimText('');
      accumulatedRef.current = '';
      conversationHistoryRef.current = [];
      setTimeout(() => startListening(), 50);
    } else if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [active, isListening, startListening, stopListening]);

  const toggleItemType = useCallback((itemId: string) => {
    updateItem(itemId, item => {
      if (item.confirmed) return item;
      const types: Array<'recap' | 'plan' | 'due'> = ['recap', 'plan', 'due'];
      const currentIdx = types.indexOf(item.result.type);
      const nextType = types[(currentIdx + 1) % types.length];
      return { ...item, result: { ...item.result, type: nextType } };
    });
  }, [updateItem]);

  const toggleHabit = useCallback((itemId: string) => {
    updateItem(itemId, item => {
      if (item.confirmed) return item;
      return { ...item, result: { ...item.result, is_habit: !item.result.is_habit } };
    });
  }, [updateItem]);

  const confirmItem = useCallback((itemId: string) => {
    const msg = chatMessages.find(m => m.item?.id === itemId);
    const item = msg?.item;
    if (!item) return;
    const title = item.editedTitle || item.result.title;
    const orig = cleanFillerWords(item.editedOriginal || item.result.original_text || '');
    
    // Skip detail if content is very similar to title
    const shouldIncludeDetail = orig.length > title.length * 1.3 && orig.length - title.length > 10;
    const finalText = shouldIncludeDetail ? `${title}\n---DETAIL---\n${orig}` : title;

    if (item.result.type === 'recap') {
      onAddMoment({ text: finalText, emoji: item.result.emoji || undefined, photos: [], tags: item.result.tags });
      toast.success('已添加到 Recap ✨');
    } else if (item.result.type === 'due') {
      if (onAddDue) {
        onAddDue(finalText, item.result.due_date || undefined, item.result.is_habit);
        toast.success(item.result.is_habit ? '已添加习惯 🔄' : '已添加 Due 📌');
      } else {
        onAddTodo(finalText, item.result.time_segment || 'anytime');
        toast.success('已添加到 Plan 📋');
      }
    } else {
      onAddTodo(finalText, item.result.time_segment || 'anytime');
      toast.success('已添加到 Plan 📋');
    }

    updateItem(itemId, i => ({ ...i, confirmed: true }));
  }, [chatMessages, onAddMoment, onAddTodo, onAddDue, updateItem]);

  const confirmAll = useCallback(() => {
    allItems.filter(i => !i.confirmed).forEach(i => confirmItem(i.id));
  }, [allItems, confirmItem]);

  const close = useCallback(() => {
    recognitionRef.current?.stop();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    setActive(false);
    setIsListening(false);
    setChatMessages([]);
    setInterimText('');
    accumulatedRef.current = '';
    conversationHistoryRef.current = [];
    setEditingId(null);
    setShowOriginalId(null);
    setDueDateDrafts({});
  }, []);

  const getTypeLabel = (type: string, isHabit?: boolean) => {
    if (type === 'recap') return '📖 Recap';
    if (type === 'due') return isHabit ? '🔄 Habit' : '📌 Due';
    return '📋 Plan';
  };

  const getTypeColor = (type: string) => {
    if (type === 'recap') return 'bg-accent text-accent-foreground';
    if (type === 'due') return 'bg-destructive/15 text-destructive';
    return 'bg-primary/15 text-primary';
  };

  const parseLooseDueDate = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    let year = currentYear;
    let month = currentMonth;
    let day = 0;
    let hour = 23;
    let minute = 59;

    const match = trimmed.match(/^(\d{1,4})(?:[./-](\d{1,2}))?(?:[./-](\d{1,4}))?(?:[,\s]+(\d{1,2}):(\d{2}))?$/);
    if (!match) return null;

    const first = Number(match[1]);
    const second = match[2] ? Number(match[2]) : null;
    const third = match[3] ? Number(match[3]) : null;

    if (second === null) {
      day = first;
    } else if (third === null) {
      month = first;
      day = second;
    } else if (String(match[1]).length === 4) {
      year = first;
      month = second;
      day = third;
    } else {
      month = first;
      day = second;
      year = third < 100 ? 2000 + third : third;
    }

    if (match[4] && match[5]) {
      hour = Number(match[4]);
      minute = Number(match[5]);
    }

    const candidate = new Date(year, month - 1, day, hour, minute);
    if (
      Number.isNaN(candidate.getTime()) ||
      candidate.getFullYear() !== year ||
      candidate.getMonth() + 1 !== month ||
      candidate.getDate() !== day ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      return null;
    }

    return format(candidate, "yyyy-MM-dd'T'HH:mm");
  }, []);

  const formatDueDate = (dateStr: string) => {
    try {
      const d = parseISO(dateStr);
      return format(d, 'MMM d, HH:mm');
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      {/* FAB mic button */}
      <button
        onClick={handleMicClick}
        className={cn(
          "fixed bottom-6 right-4 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200",
          active && isListening
            ? "bg-destructive text-destructive-foreground scale-110 animate-pulse"
            : "bg-primary text-primary-foreground hover:scale-105 active:scale-95"
        )}
      >
        {isListening ? <MicOff size={22} /> : <Mic size={22} />}
      </button>

      {/* Inline bubble panel */}
      {active && (
        <div className="fixed bottom-20 right-4 z-50 w-[320px] max-h-[420px] flex flex-col animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="flex justify-end mb-1">
            <button onClick={close} className="w-6 h-6 rounded-full bg-muted/80 text-muted-foreground hover:text-foreground flex items-center justify-center">
              <X size={12} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 max-h-[350px] pb-2">
            {/* Interleaved chat messages: user → assistant → user → assistant */}
            {chatMessages.map(msg => {
              if (msg.role === 'user') {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm px-3 py-2 text-sm bg-primary/10 border border-primary/20 text-foreground">
                      {msg.userText}
                    </div>
                  </div>
                );
              }

              // Assistant message — either query answer or parsed item
              if (msg.queryAnswer) {
                return (
                  <div key={msg.id} className="flex justify-start">
                    <div className="max-w-[95%] rounded-2xl rounded-bl-sm border border-primary/20 bg-primary/5 px-3 py-2.5 text-[13px] text-foreground/80 leading-relaxed">
                      {msg.queryAnswer}
                    </div>
                  </div>
                );
              }

              if (msg.item) {
                const item = msg.item;
                return (
                  <div key={msg.id} className="flex justify-start">
                    <div className={cn(
                      "max-w-[95%] rounded-2xl rounded-bl-sm border px-3 py-2.5 space-y-1.5 animate-in fade-in duration-200",
                      item.confirmed
                        ? "border-primary/20 bg-primary/5 opacity-60"
                        : "border-border bg-card"
                    )}>
                      {/* Type badge row */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => !item.confirmed && toggleItemType(item.id)}
                          className={cn(
                            "text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full transition-colors",
                            getTypeColor(item.result.type),
                            !item.confirmed && "cursor-pointer hover:opacity-80"
                          )}
                        >
                          {getTypeLabel(item.result.type, item.result.is_habit)}
                        </button>
                        {item.result.emoji && <span className="text-base">{item.result.emoji}</span>}
                        {item.result.type === 'due' && !item.confirmed && (
                          <button
                            onClick={() => toggleHabit(item.id)}
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 transition-colors",
                              item.result.is_habit
                                ? "bg-primary/15 text-primary"
                                : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                            )}
                          >
                            <Repeat size={8} />
                            {item.result.is_habit ? t('chatbot.habit') : t('chatbot.oneTime')}
                          </button>
                        )}
                        {item.confirmed && <Check size={12} className="text-primary ml-auto" />}
                      </div>

                      {/* Title */}
                      {editingId === item.id ? (
                        <input
                          value={item.editedTitle}
                          onChange={e => updateItem(item.id, i => ({ ...i, editedTitle: e.target.value }))}
                          onBlur={() => setEditingId(null)}
                          onKeyDown={e => { if (e.key === 'Enter') setEditingId(null); }}
                          className="text-sm text-foreground font-medium w-full bg-transparent border-b border-primary/30 focus:outline-none py-0.5"
                          autoFocus
                        />
                      ) : (
                        <p
                          className={cn(
                            "text-sm text-foreground font-medium",
                            !item.confirmed && "cursor-pointer hover:text-primary/80 transition-colors"
                          )}
                          onClick={() => !item.confirmed && setEditingId(item.id)}
                        >
                          {item.editedTitle}
                        </p>
                      )}

                      {/* Due date */}
                      {item.result.type === 'due' && !item.confirmed && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Calendar size={10} />
                          <input
                            type="text"
                            inputMode="numeric"
                            value={dueDateDrafts[item.id] ?? (item.result.due_date ? formatDueDate(item.result.due_date) : '')}
                            onChange={e => {
                              const raw = e.target.value;
                              setDueDateDrafts(prev => ({ ...prev, [item.id]: raw }));
                              const parsed = parseLooseDueDate(raw);
                              if (parsed !== null) {
                                updateItem(item.id, i => ({
                                  ...i,
                                  result: {
                                    ...i.result,
                                    due_date: parsed,
                                  },
                                }));
                              }
                            }}
                            onBlur={e => {
                              const raw = e.target.value.trim();
                              if (!raw) {
                                setDueDateDrafts(prev => {
                                  const next = { ...prev };
                                  delete next[item.id];
                                  return next;
                                });
                                updateItem(item.id, i => ({ ...i, result: { ...i.result, due_date: undefined } }));
                                return;
                              }
                              const parsed = parseLooseDueDate(raw);
                              if (parsed === null) {
                                toast.error('Invalid deadline. Use D, M/D, or M/D/YYYY. Time defaults to 23:59.');
                                setDueDateDrafts(prev => ({
                                  ...prev,
                                  [item.id]: item.result.due_date ? formatDueDate(item.result.due_date) : raw,
                                }));
                                return;
                              }
                              setDueDateDrafts(prev => ({
                                ...prev,
                                [item.id]: formatDueDate(parsed),
                              }));
                              updateItem(item.id, i => ({ ...i, result: { ...i.result, due_date: parsed } }));
                            }}
                            className="bg-transparent text-[11px] text-muted-foreground focus:outline-none border-b border-transparent hover:border-border focus:border-primary w-[180px]"
                            placeholder="yyyy/mm/dd, --:--"
                          />
                        </div>
                      )}
                      {item.result.type === 'due' && item.confirmed && item.result.due_date && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Calendar size={10} />
                          <span>Due: {formatDueDate(item.result.due_date)}</span>
                        </div>
                      )}

                      {/* Time info */}
                      {!item.confirmed && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.result.type === 'plan' && (
                            <select
                              value={item.result.time_segment || 'anytime'}
                              onChange={e => updateItem(item.id, i => ({ ...i, result: { ...i.result, time_segment: e.target.value } }))}
                              className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-transparent text-foreground"
                            >
                              <option value="morning">☀ 上午</option>
                              <option value="afternoon">🌤 下午</option>
                              <option value="evening">🌙 晚上</option>
                              <option value="anytime">📌 任何时间</option>
                            </select>
                          )}
                          <div className="flex items-center gap-1">
                            <Clock size={10} className="text-muted-foreground/50" />
                            <input
                              type="time"
                              value={item.result.start_time || ''}
                              onChange={e => updateItem(item.id, i => ({ ...i, result: { ...i.result, start_time: e.target.value } }))}
                              className="text-[10px] px-1 py-0.5 rounded border border-border bg-transparent text-foreground w-[72px]"
                              placeholder="开始"
                            />
                            <span className="text-[10px] text-muted-foreground/40">→</span>
                            <input
                              type="time"
                              value={item.result.end_time || ''}
                              onChange={e => updateItem(item.id, i => ({ ...i, result: { ...i.result, end_time: e.target.value } }))}
                              className="text-[10px] px-1 py-0.5 rounded border border-border bg-transparent text-foreground w-[72px]"
                              placeholder="结束"
                            />
                          </div>
                          {item.result.duration_minutes && (
                            <span className="text-[10px] text-muted-foreground/50">({item.result.duration_minutes}分钟)</span>
                          )}
                        </div>
                      )}
                      {item.confirmed && item.result.start_time && (
                        <p className="text-[10px] text-muted-foreground">
                          ⏰ {item.result.start_time}
                          {item.result.end_time && ` → ${item.result.end_time}`}
                          {item.result.duration_minutes ? ` (${item.result.duration_minutes}分钟)` : ''}
                        </p>
                      )}

                      {/* Detail toggle */}
                      {(() => {
                        const orig = cleanFillerWords(item.editedOriginal || item.result.original_text || '');
                        const title = item.editedTitle || item.result.title;
                        const shouldShow = orig.length > title.length * 1.3 && orig.length - title.length > 10;
                        if (!shouldShow) return null;
                        return (
                          <>
                            <button onClick={() => setShowOriginalId(showOriginalId === item.id ? null : item.id)}
                              className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-muted-foreground">
                              {showOriginalId === item.id ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                              {showOriginalId === item.id ? t('chatbot.collapseDetail') : t('chatbot.expandDetail')}
                            </button>
                            {showOriginalId === item.id && (
                              item.confirmed ? (
                                <p className="text-[11px] text-muted-foreground/70 bg-secondary/50 rounded-lg px-2 py-1.5">{orig}</p>
                              ) : (
                                <textarea
                                  value={item.editedOriginal || orig}
                                  onChange={e => updateItem(item.id, i => ({ ...i, editedOriginal: e.target.value }))}
                                  className="text-[11px] text-muted-foreground/70 bg-secondary/50 rounded-lg px-2 py-1.5 w-full resize-none focus:outline-none focus:ring-1 focus:ring-primary/30 min-h-[40px]"
                                  rows={3}
                                />
                              )
                            )}
                          </>
                        );
                      })()}

                      {/* Tags */}
                      {item.result.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {item.result.tags.map(tag => (
                            <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">#{tag}</span>
                          ))}
                        </div>
                      )}

                      {/* Confirm button */}
                      {!item.confirmed && (
                        <button onClick={() => confirmItem(item.id)}
                          className="w-full flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 mt-1">
                          {t('chatbot.confirmAdd')} <ArrowRight size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              }

              return null;
            })}

            {/* Interim speech text */}
            {isListening && interimText && (
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm px-3 py-2 text-sm bg-muted/40 border border-border text-muted-foreground">
                  {interimText}
                </div>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-muted/60 border border-border px-3 py-2 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">{t('chatbot.analyzing')}</span>
                </div>
              </div>
            )}

            {/* Listening indicator */}
            {isListening && !interimText && chatMessages.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-4">
                <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
                <span className="text-xs text-muted-foreground">{t('chatbot.listening')}</span>
              </div>
            )}
          </div>

          {/* Bottom action bar */}
          {unconfirmedCount > 1 && (
            <div className="mt-2">
              <button onClick={confirmAll}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                {t('chatbot.confirmAll')} ({unconfirmedCount}) <Check size={14} />
              </button>
            </div>
          )}

          {/* Text input + continue recording */}
          {!isListening && !loading && (
            <div className="mt-2 flex items-center gap-1.5">
              <input
                type="text"
                placeholder={t('chatbot.typePlaceholder') || '输入文字...'}
                className="flex-1 text-sm bg-muted/50 border border-border rounded-full px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground/50"
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                    const val = (e.target as HTMLInputElement).value;
                    classify(val);
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
              <button onClick={startListening}
                className="flex items-center justify-center w-8 h-8 rounded-full border border-border hover:border-primary/30 text-muted-foreground hover:text-foreground transition-colors">
                <Mic size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
