import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useProfile } from '@/hooks/useProfile';

type Lang = 'zh' | 'en';

const translations: Record<string, Record<Lang, string>> = {
  // TopNav
  'nav.today': { zh: '今日', en: 'Today' },
  'nav.calendar': { zh: '日历', en: 'Calendar' },
  'nav.recap': { zh: '回顾', en: 'Recap' },
  'nav.dues': { zh: 'Dues', en: 'Dues' },
  'nav.places': { zh: '地点', en: 'Places' },
  'nav.notes': { zh: '便签', en: 'Notes' },
  'nav.links': { zh: 'Links', en: 'Links' },
  'nav.profile': { zh: '我的', en: 'Me' },
  // Today modes
  'mode.plan': { zh: '计划', en: 'Plan' },
  'mode.recap': { zh: '回顾', en: 'Recap' },
  'mode.timeline': { zh: '时间线', en: 'Timeline' },
  'mode.viewTimeline': { zh: '今日整体 Timeline', en: "Today's Full Timeline" },
  // TodayView
  'today.leftToday': { zh: '今日剩余', en: 'Remaining' },
  'today.hoursPassed': { zh: '今日已过', en: 'Elapsed' },
  'today.timeRecorded': { zh: '时间已记录', en: 'time recorded' },
  'today.doneToday': { zh: '今日完成', en: 'Done today' },
  'today.whatYouDid': { zh: '你做了什么', en: 'What you did' },
  'today.noTasks': { zh: '还没有完成任务', en: 'No tasks completed yet' },
  'today.placeholder': { zh: '你刚刚做了什么？', en: 'What did you do just now?' },
  'today.listening': { zh: '正在听...', en: 'Listening...' },
  'today.add': { zh: '添加', en: 'Add' },
  'today.addTime': { zh: '+ 添加时间', en: '+ add time' },
  'today.remainPrefix': { zh: '还剩', en: '' },
  'today.onlyToGo': { zh: '件', en: ' to go' },
  'today.thingsDone': { zh: '件已完成', en: ' done' },
  'profile.time': { zh: '时间', en: 'Time' },
  // Plan
  'plan.list': { zh: '📋 列表', en: '📋 List' },
  'plan.timeline': { zh: '📊 时间线', en: '📊 Timeline' },
  'plan.hours': { zh: '小时', en: 'hours' },
  'plan.selected': { zh: '已选', en: 'Selected' },
  'plan.minutes': { zh: '分钟', en: 'min' },
  'plan.inputPlaceholder': { zh: '输入名称，回车添加', en: 'Type name and press Enter' },
  'plan.dot.inputPlaceholder': { zh: '输入名称，回车添加', en: 'Type name and press Enter' },
  'plan.tasks': { zh: '任务', en: 'Tasks' },
  'plan.deadlinesHabits': { zh: 'Dues & 习惯', en: 'Deadlines & Habits' },
  'plan.addTask': { zh: '添加任务...', en: 'Add a task...' },
  'plan.timeSlot': { zh: '时间段', en: 'Time slot' },
  'plan.setReminder': { zh: '设置提醒', en: 'Set Reminder' },
  'plan.repeatDaily': { zh: '每天重复直到完成', en: 'Repeat daily until done' },
  'plan.addAndStart': { zh: '添加并开始计时', en: 'Add & start timer' },
  'plan.grouped': { zh: '分组', en: 'Grouped' },
  'plan.flat': { zh: '列表', en: 'Flat' },
  'plan.done': { zh: '已完成', en: 'Done' },
  'plan.seg.anytime': { zh: '随时', en: 'Anytime' },
  'plan.seg.morning': { zh: '早晨', en: 'Morning' },
  'plan.seg.afternoon': { zh: '下午', en: 'Afternoon' },
  'plan.seg.evening': { zh: '晚间', en: 'Evening' },
  'plan.fullTimeline': { zh: '今日整体 Timeline >', en: "Today's Full Timeline >" },
  'plan.dragHere': { zh: '拖拽任务到这里', en: 'Drag tasks here' },
  'plan.timerStartedAt': { zh: '计时开始于', en: 'Timer started at' },
  'plan.resumeTimer': { zh: '继续计时', en: 'Resume timer' },
  'plan.resetTimer': { zh: '重新开始计时', en: 'Reset timer' },
  // Focus timer — "Continue later" = end this phase (save segment, task stays open)
  'focus.endPhase': { zh: '阶段性结束', en: 'End this phase' },
  'focus.endPhaseHint': {
    zh: '保存本段专注并结束本轮；任务未完成，可再点计时开启新一轮。',
    en: 'Save this block and close the timer. Still open — tap the timer anytime to resume a fresh stretch.',
  },
  'focus.overlayContinuing': { zh: '继续计时', en: 'Resume' },
  'focus.overlayFocusing': { zh: '专注中', en: 'Focusing' },
  'focus.resumeChip': { zh: '可继续计时', en: 'Tap to resume' },
  'plan.startFocusTimer': { zh: '开始专注计时', en: 'Start focus timer' },
  'profile.title': { zh: '个人设置', en: 'Profile Settings' },
  'profile.displayName': { zh: '显示名称', en: 'Display Name' },
  'profile.wakeTime': { zh: '起床时间', en: 'Wake Time' },
  'profile.bedtime': { zh: '睡觉时间', en: 'Bedtime' },
  'profile.homepageImage': { zh: '首页图片', en: 'Homepage Image' },
  'profile.changeImage': { zh: '更换图片', en: 'Change Image' },
  'profile.language': { zh: '语言', en: 'Language' },
  'profile.signOut': { zh: '退出登录', en: 'Sign Out' },
  'profile.save': { zh: '保存', en: 'Save' },
  'profile.journey': { zh: '你的生活', en: 'Your Life' },
  'profile.journeyDesc': { zh: '记录你走过的每一天', en: 'Evidence of Life' },
  'profile.days': { zh: '记录天数', en: 'Days Recorded' },
  'profile.moments': { zh: '活动瞬间', en: 'Moments' },
  'profile.places': { zh: '去过地点', en: 'Places' },
  'profile.tasksDone': { zh: '记录事件', en: 'Events' },
  'profile.memory': { zh: '回忆', en: 'Memory' },
  'profile.memoryDesc': { zh: '来自你的生活记录', en: 'From your life records' },
  // Quick tags
  'tag.hangout': { zh: '聚会', en: 'Hangout' },
  'tag.dineOut': { zh: '外食', en: 'Dine out' },
  'tag.cook': { zh: '做饭', en: 'Cook' },
  'tag.groceries': { zh: '买菜', en: 'Groceries' },
  'tag.walk': { zh: '散步', en: 'Walk' },
  'tag.coffee': { zh: '咖啡', en: 'Coffee' },
  'tag.movie': { zh: '电影', en: 'Movie' },
  'today.noMoments': { zh: '还没有记录', en: 'No moments yet' },
  // Dues
  'dues.title': { zh: 'Dues & 习惯', en: 'Deadlines & Habits' },
  'dues.subtitle': { zh: '追踪 dues、习惯并积累进度', en: 'Track deadlines, habits & accumulate progress' },
  'dues.deadlinePlaceholder': { zh: '什么事要到期？', en: "What's due?" },
  'dues.habitPlaceholder': { zh: '新习惯或项目...', en: 'New habit or project...' },
  'dues.deadline': { zh: '📅 Due', en: '📅 Deadline' },
  'dues.habit': { zh: '🔄 习惯', en: '🔄 Habit' },
  'dues.deadlines': { zh: 'Dues', en: 'Deadlines' },
  'dues.habits': { zh: '习惯', en: 'Habits' },
  'dues.completed': { zh: '已完成', en: 'Completed' },
  'dues.markDone': { zh: '标记完成', en: 'Mark done' },
  'dues.completedLabel': { zh: '已完成', en: 'Completed' },
  'dues.addToToday': { zh: '添加到今天', en: 'Add to today' },
  'dues.addedToToday': { zh: '已添加到今天', en: 'Added to today' },
  'dues.add': { zh: '添加', en: 'Add' },
  'dues.addLink': { zh: '添加链接', en: 'Add link' },
  'dues.addPhoto': { zh: '添加图片', en: 'Add photo' },
  'dues.addDeadline': { zh: '添加期限', en: 'Add deadline' },
  'dues.remove': { zh: '移除', en: 'Remove' },
  'dues.progress': { zh: '进度', en: 'Progress' },
  'dues.punchCard': { zh: '打卡记录', en: 'Punch card' },
  'dues.empty': { zh: '还没有项目——在上方添加期限或习惯', en: 'No items yet — add a deadline or habit above' },
  'dues.completed_count': { zh: '已完成', en: 'completed' },
  'dues.total': { zh: '总计', en: 'total' },
  'dues.overdue': { zh: '已逾期', en: 'overdue' },
  'dues.left': { zh: '剩余', en: 'left' },
  'dues.habitProject': { zh: '习惯 / 项目', en: 'Habit / Project' },
  'dues.photo': { zh: '照片', en: 'Photo' },
  'dues.link': { zh: '链接', en: 'Link' },
  'dues.labelOptional': { zh: '名称 (可选)', en: 'Label (optional)' },
  'dues.addBtn': { zh: '添加', en: 'Add' },
  'dues.todayUrgent': { zh: '今日 / 紧急', en: 'Today / Urgent' },
  'dues.upcoming': { zh: '即将到来', en: 'Upcoming' },
  'dues.voiceListening': { zh: '正在听...', en: 'Listening...' },
  'dues.addStep': { zh: '+ 添加步骤', en: '+ Add step' },
  'dues.steps': { zh: '步骤', en: 'Steps' },
  'chatbot.confirmAdd': { zh: '确认添加', en: 'Confirm' },
  'chatbot.confirmAll': { zh: '全部确认', en: 'Confirm all' },
  'chatbot.continue': { zh: '继续说', en: 'Continue' },
  'chatbot.analyzing': { zh: 'AI 分析中...', en: 'Analyzing...' },
  'chatbot.listening': { zh: '正在聆听，请开始说话...', en: 'Listening, start speaking...' },
  'chatbot.collapseDetail': { zh: '收起详情', en: 'Hide detail' },
  'chatbot.expandDetail': { zh: '查看详情', en: 'View detail' },
  'chatbot.noDeadline': { zh: '无截止日期', en: 'No deadline' },
  'chatbot.setDeadline': { zh: '设置截止日期', en: 'Set deadline' },
  'chatbot.oneTime': { zh: '一次性', en: 'One-time' },
  'chatbot.habit': { zh: '习惯', en: 'Habit' },
  'dues.days': { zh: '天', en: 'days' },
  // Plan Drift
  'drift.title': { zh: '计划偏移', en: 'Plan Drift' },
  'drift.completed': { zh: '已完成', en: 'completed' },
  'drift.missed': { zh: '未完成', en: 'Missed' },
  'drift.overtime': { zh: '超时', en: 'Overtime' },
  'drift.unplanned': { zh: '计划外', en: 'Unplanned' },
  'drift.task': { zh: '个任务', en: 'task' },
  'drift.tasks': { zh: '个任务', en: 'tasks' },
  'drift.event': { zh: '个事件', en: 'event' },
  'drift.events': { zh: '个事件', en: 'events' },
  'drift.plan': { zh: '计划', en: 'plan' },
  'drift.actual': { zh: '实际', en: 'actual' },
  'drift.execPlanned': { zh: '计划', en: 'Planned' },
  'drift.execFocused': { zh: '专注', en: 'Focused' },
  'drift.execParallel': { zh: '本段多任务重叠；柱高为墙钟并集（未重复计时）', en: 'Overlapping tasks in this window — bar uses merged wall time (no double count).' },
  'drift.execSliceEmpty': { zh: '本段暂无任务明细', en: 'No task detail in this slice' },
  // Plan view
  'plan.comingUp': { zh: '即将到来', en: 'Coming up' },
  'plan.scheduled': { zh: '已排期', en: 'scheduled' },
  'plan.now': { zh: '现在', en: 'now' },
  'plan.timelineName': { zh: '时间线', en: 'Timeline' },
  // Chatbot
  'chatbot.typePlaceholder': { zh: '输入文字...', en: 'Type here...' },
  // Notes / Sticky
  'notes.header': { zh: '便签', en: 'Notes' },
  'notes.reminder': { zh: '随手记', en: 'Reminders' },
  'notes.freeTime': { zh: '闲来做', en: "When I'm Free" },
  'notes.reminderSub': { zh: '随时记，不急', en: 'Jot it down, no rush' },
  'notes.freeTimeSub': { zh: '闲下来可以做的', en: 'Things to do when free' },
  'notes.notePlaceholder.reminder': { zh: '便签标题，如"国内要买的"', en: 'Note title, e.g. "Books to read"' },
  'notes.notePlaceholder.freeTime': { zh: '便签标题，如"想看的电影"', en: 'Note title, e.g. "Movies to watch"' },
  'notes.addItem': { zh: '添加项目...', en: 'Add item...' },
  'notes.empty': { zh: '还没有便签，新建一个吧', en: 'No notes yet — create one above' },
  'notes.confirmDelete': { zh: '删除?', en: 'Delete?' },
  // Map view
  'map.allPlaces': { zh: '所有地点', en: 'All Places' },
  'map.food': { zh: '美食', en: 'Food' },
  'map.coffee': { zh: '咖啡', en: 'Coffee' },
  'map.outdoors': { zh: '户外', en: 'Outdoors' },
  'map.culture': { zh: '文化', en: 'Culture' },
  'map.all': { zh: '全部', en: 'All' },
  'map.places': { zh: '地点', en: 'Places' },
  'map.noPlaces': { zh: '还没有地点', en: 'No places yet' },
  'map.noPlacesHint': { zh: '给你的瞬间添加位置信息', en: 'Add locations to your moments' },
  'map.visit': { zh: '次到访', en: 'visit' },
  'map.visits': { zh: '次到访', en: 'visits' },
  'map.photo': { zh: '张照片', en: 'photo' },
  'map.photos': { zh: '张照片', en: 'photos' },
  'map.noPhotosYet': { zh: '暂无照片', en: 'No photos yet' },
  // Recap time
  'recap.setTime': { zh: '设置时间', en: 'Set time' },
  'recap.startTime': { zh: '开始', en: 'Start' },
  'recap.endTime': { zh: '结束', en: 'End' },
  'recap.missed': { zh: '未完成', en: 'Missed' },
  'recap.timeline': { zh: '时间线', en: 'Timeline' },
  'recap.moments': { zh: '个瞬间', en: 'moments' },
  'recap.moment': { zh: '个瞬间', en: 'moment' },
  'recap.lifeReplay': { zh: '生活回放', en: 'Life Replay' },
  'recap.generate': { zh: '生成', en: 'Generate' },
  'recap.generateFailed': { zh: '生成失败', en: 'Could not generate story' },
  'recap.morning': { zh: '上午', en: 'Morning' },
  'recap.afternoon': { zh: '下午', en: 'Afternoon' },
  'recap.evening': { zh: '晚上', en: 'Evening' },
  'recap.night': { zh: '深夜', en: 'Night' },
  'recap.detail': { zh: '详情', en: 'detail' },
  'recap.hideDetail': { zh: '收起详情', en: 'Hide detail' },
  'recap.viewDetail': { zh: '查看详情', en: 'View detail' },
  // Profile custom tags
  'profile.planTags': { zh: '计划标签', en: 'Plan Tags' },
  'profile.recapTags': { zh: '回顾标签', en: 'Recap Tags' },
  'profile.emojiOptions': { zh: 'Emoji 选项', en: 'Emoji Options' },
  'profile.addPlanTag': { zh: '添加 Plan 标签...', en: 'Add plan tag...' },
  'profile.addRecapTag': { zh: '添加 Recap 标签...', en: 'Add recap tag...' },
  'profile.pasteEmoji': { zh: '粘贴 emoji...', en: 'Paste emoji...' },
  // Plan tags (defaults)
  'ptag.gym': { zh: '健身', en: 'Gym' },
  'ptag.library': { zh: '图书馆', en: 'Library' },
  'ptag.hw': { zh: '作业', en: 'HW' },
  'ptag.wellness': { zh: '养生', en: 'Wellness' },
  'ptag.meeting': { zh: '会议', en: 'Meeting' },
  'ptag.errands': { zh: '跑腿', en: 'Errands' },
  'ptag.study': { zh: '学习', en: 'Study' },
};

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'zh',
  setLang: () => {},
  t: (key: string) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem('app-language');
    return (stored === 'en' || stored === 'zh') ? stored : 'zh';
  });
  const { profile, updateProfile } = useProfile();

  useEffect(() => {
    const stored = localStorage.getItem('app-language');
    if (stored === 'en' || stored === 'zh') return;

    if (profile?.language && (profile.language === 'en' || profile.language === 'zh')) {
      const next = profile.language as Lang;
      setLangState(next);
      localStorage.setItem('app-language', next);
    }
  }, [profile?.language]);

  const setLang = useCallback((newLang: Lang) => {
    if (newLang === lang) return;
    setLangState(newLang);
    localStorage.setItem('app-language', newLang);
    updateProfile({ language: newLang } as any);
  }, [updateProfile, lang]);

  // Apply lang class to body for font weight
  useEffect(() => {
    document.body.classList.toggle('lang-zh', lang === 'zh');
  }, [lang]);

  const t = useCallback((key: string) => {
    const entry = translations[key];
    if (!entry) return key;
    const val = entry[lang];
    return val !== undefined ? val : key;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
