import en from './en';
import ru from './ru';
import uk from './uk';
import be from './be';
import pl from './pl';
import es from './es';
import esAR from './esAR';
import pt from './pt';
import ptBR from './ptBR';
import zh from './zh';
import tr from './tr';
import type { Locale } from '@/store/languageStore';

const translations: Record<Locale, typeof en> = { en, ru, uk, be, pl, es, esAR, pt, ptBR, zh, tr };
export default translations;
