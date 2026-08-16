import { usePrefs } from '../store/usePrefs';
import type { Lang } from '../store/usePrefs';

type Dict = Record<string, string>;

// Worker-facing strings first (menus, login, attendance, money, requests).
// Admin-only screens fall back to English. Add keys here to translate more.
const en: Dict = {
  // nav
  'nav.dashboard': 'Dashboard',
  'nav.employees': 'Employees',
  'nav.attendance': 'Attendance',
  'nav.projects': 'Projects',
  'nav.projectExpense': 'Project Expense',
  'nav.salary': 'Salary',
  'nav.advances': 'Advances',
  'nav.ledger': 'Ledger',
  'nav.settings': 'Settings',
  'nav.myMoney': 'My Money',
  'nav.history': 'History',
  // preferences
  'pref.title': 'Preferences',
  'pref.language': 'Language',
  'pref.sound': 'Sounds',
  'pref.soundHint': 'Taps & notification sounds',
  'pref.on': 'On',
  'pref.off': 'Off',
  // login
  'login.tagline': 'Salary & Advance, made simple',
  'login.who': "Who's logging in?",
  'login.worker': "I'm a Worker",
  'login.workerSub': 'See my salary & request advance',
  'login.admin': "I'm the Admin",
  'login.adminSub': 'Manage everyone & approve advances',
  'login.phoneTitle': 'Your Phone Number',
  'login.phoneSub': 'The number your admin registered',
  'login.enterPin': 'Enter your 4-digit PIN',
  'login.continue': 'Continue',
  'login.wrongPin': 'Wrong PIN',
  'login.fingerprint': 'Use fingerprint',
  'login.back': 'Back',
  'login.pickName': "Can't match your number? Pick your name",
  // employee home
  'home.goodMorning': 'Good morning',
  'home.goodAfternoon': 'Good afternoon',
  'home.goodEvening': 'Good evening',
  'home.todayAttendance': "Today's Attendance",
  'home.open': 'Open Attendance',
  'home.close': 'Close Attendance',
  'home.locating': 'Locating…',
  'home.workingNow': 'working now',
  'home.notOpened': 'Attendance not opened yet',
  'home.doneForNow': 'Done for now',
  'home.requestAdvance': 'Request an Advance',
  'home.requestAdvanceSub': 'Get money now, repay from your salary',
  'home.salaryToReceive': 'Salary to receive',
  'home.advanceToRepay': 'Advance to repay',
  'home.thisWeek': 'This Week',
  'home.days': 'Days',
  'home.hours': 'Hours',
  'home.earned': 'Earned',
  'home.payslip': 'My Payslip PDF',
  'home.fullHistory': 'Full history',
  // project expense
  'pe.title': 'Project Expenditure',
  'pe.workerSub': 'Request money you spent on a project',
  'pe.request': 'Project Request',
  'pe.project': 'Project',
  'pe.category': 'Category',
  'pe.amount': 'Amount',
  'pe.note': 'Note',
  'pe.send': 'Send Request',
  'pe.pending': 'Pending Approval',
  'pe.waiting': 'Waiting for admin approval…',
  // common
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.history': 'History',
};

const ta: Dict = {
  // nav
  'nav.dashboard': 'முகப்பு',
  'nav.employees': 'பணியாளர்கள்',
  'nav.attendance': 'வருகை',
  'nav.projects': 'திட்டங்கள்',
  'nav.projectExpense': 'திட்டச் செலவு',
  'nav.salary': 'சம்பளம்',
  'nav.advances': 'முன்பணம்',
  'nav.ledger': 'கணக்கு',
  'nav.settings': 'அமைப்புகள்',
  'nav.myMoney': 'என் பணம்',
  'nav.history': 'வரலாறு',
  // preferences
  'pref.title': 'விருப்பங்கள்',
  'pref.language': 'மொழி',
  'pref.sound': 'ஒலி',
  'pref.soundHint': 'தட்டல் & அறிவிப்பு ஒலிகள்',
  'pref.on': 'இயக்கு',
  'pref.off': 'அணை',
  // login
  'login.tagline': 'சம்பளம் & முன்பணம், எளிதாக',
  'login.who': 'யார் உள்நுழைகிறது?',
  'login.worker': 'நான் ஒரு பணியாளர்',
  'login.workerSub': 'என் சம்பளம் & முன்பணம் பார்க்க',
  'login.admin': 'நான் நிர்வாகி',
  'login.adminSub': 'அனைவரையும் நிர்வகித்து முன்பணம் அனுமதி',
  'login.phoneTitle': 'உங்கள் தொலைபேசி எண்',
  'login.phoneSub': 'நிர்வாகி பதிவு செய்த எண்',
  'login.enterPin': 'உங்கள் 4-இலக்க பின்னை உள்ளிடவும்',
  'login.continue': 'தொடரவும்',
  'login.wrongPin': 'தவறான பின்',
  'login.fingerprint': 'கைரேகையைப் பயன்படுத்து',
  'login.back': 'பின்',
  'login.pickName': 'எண் பொருந்தவில்லையா? உங்கள் பெயரைத் தேர்வு செய்யவும்',
  // employee home
  'home.goodMorning': 'காலை வணக்கம்',
  'home.goodAfternoon': 'மதிய வணக்கம்',
  'home.goodEvening': 'மாலை வணக்கம்',
  'home.todayAttendance': 'இன்றைய வருகை',
  'home.open': 'வருகை தொடங்கு',
  'home.close': 'வருகை முடி',
  'home.locating': 'இடம் தேடுகிறது…',
  'home.workingNow': 'வேலையில்',
  'home.notOpened': 'வருகை இன்னும் தொடங்கவில்லை',
  'home.doneForNow': 'இப்போதைக்கு முடிந்தது',
  'home.requestAdvance': 'முன்பணம் கேட்க',
  'home.requestAdvanceSub': 'இப்போது பணம் பெறு, சம்பளத்தில் திருப்பிச் செலுத்து',
  'home.salaryToReceive': 'பெறவேண்டிய சம்பளம்',
  'home.advanceToRepay': 'திருப்பவேண்டிய முன்பணம்',
  'home.thisWeek': 'இந்த வாரம்',
  'home.days': 'நாட்கள்',
  'home.hours': 'மணிநேரம்',
  'home.earned': 'ஈட்டியது',
  'home.payslip': 'என் சம்பள சீட்டு (PDF)',
  'home.fullHistory': 'முழு வரலாறு',
  // project expense
  'pe.title': 'திட்டச் செலவு',
  'pe.workerSub': 'திட்டத்திற்காக செலவழித்த பணத்தைக் கேளுங்கள்',
  'pe.request': 'திட்டக் கோரிக்கை',
  'pe.project': 'திட்டம்',
  'pe.category': 'வகை',
  'pe.amount': 'தொகை',
  'pe.note': 'குறிப்பு',
  'pe.send': 'கோரிக்கை அனுப்பு',
  'pe.pending': 'அனுமதிக்காக காத்திருக்கிறது',
  'pe.waiting': 'நிர்வாகி அனுமதிக்காக காத்திருக்கிறது…',
  // common
  'common.cancel': 'ரத்து',
  'common.save': 'சேமி',
  'common.history': 'வரலாறு',
};

const DICTS: Record<Lang, Dict> = { en, ta };

export function translate(lang: Lang, key: string, fallback?: string): string {
  return DICTS[lang]?.[key] ?? en[key] ?? fallback ?? key;
}

// Hook: returns a t() bound to the current language (re-renders on change).
export function useT() {
  const lang = usePrefs((s) => s.lang);
  return (key: string, fallback?: string) => translate(lang, key, fallback);
}

export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ta', label: 'தமிழ்' },
];
