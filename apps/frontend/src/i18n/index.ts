import en from './en';
import ru from './ru';
import es from './es';
import zh from './zh';
import type { Locale } from '@/store/languageStore';

const translations: Record<Locale, typeof en> = { en, ru, es, zh };
export default translations;
