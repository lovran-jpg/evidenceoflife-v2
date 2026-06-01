const KEYWORDS = {
  happy: ["excited", "finally", "booked", "yay", "great", "nice", "开心", "终于", "好耶"],
  calm: ["okay", "normal", "peaceful", "quiet", "普通", "平静", "还行"],
  tired: ["busy", "tired", "deadline", "late", "累", "崩溃", "赶", "烦"],
  sad: ["sad", "miss", "cry", "难过", "伤心"],
  love: ["love", "grateful", "thankful", "喜欢", "感恩", "温暖"],
};

export function classifyMood(text?: string): { mood: string; emoji: string | null } {
  if (!text) return { mood: 'neutral', emoji: null };
  const s = text.toLowerCase();

  // Prefer more specific/loving matches first
  for (const kw of KEYWORDS.love) if (s.includes(kw)) return { mood: 'love', emoji: '🥰' };
  for (const kw of KEYWORDS.happy) if (s.includes(kw)) return { mood: 'happy', emoji: '😄' };
  for (const kw of KEYWORDS.calm) if (s.includes(kw)) return { mood: 'calm', emoji: '🙂' };
  for (const kw of KEYWORDS.tired) if (s.includes(kw)) return { mood: 'tired', emoji: '😮‍💨' };
  for (const kw of KEYWORDS.sad) if (s.includes(kw)) return { mood: 'sad', emoji: '😢' };

  return { mood: 'neutral', emoji: null };
}

export default classifyMood;
