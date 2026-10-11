// 영어 문장 → 문장 성분 덩어리 [{t:'He', r:'S'}, {t:'should swim', r:'V'}, ...]
//
// r 값: W 의문사 · S 주어 · V 동사 · O 목적어 · C 보어 · M 수식어 · J 접속사 · X 기타(Yes/No, There, 감탄)
// compromise 로 품사를 붙이고, 그 위에 학교 문법식 규칙으로 덩어리를 나눕니다.
// 규칙이 틀리는 문장은 tools/parse_fixes.json 에서 손으로 바로잡습니다.
import nlp from 'compromise';

const BE = new Set(['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being']);
const DO = new Set(['do', 'does', 'did']);
const MODAL = new Set(['can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must']);
const HAVE = new Set(['have', 'has', 'had']);
const WH = new Set(['what', 'where', 'when', 'who', 'whom', 'whose', 'why', 'how', 'which']);
const PREP = new Set(['in', 'on', 'at', 'to', 'from', 'with', 'for', 'of', 'about', 'by', 'under', 'over', 'near', 'behind',
  'between', 'into', 'onto', 'through', 'across', 'along', 'around', 'after', 'before', 'since', 'until', 'during', 'like',
  'without', 'inside', 'outside', 'beside', 'above', 'below', 'toward', 'towards', 'up', 'down', 'off', 'than', 'among', 'past',
  'next', 'front', 'out']);
const TIME_HEAD = new Set(['every', 'last', 'next', 'this', 'that', 'these', 'those', 'each', 'tomorrow', 'yesterday', 'today', 'tonight']);
const MWORD = new Set(['here', 'there', 'now', 'then', 'today', 'tomorrow', 'yesterday', 'tonight', 'too', 'also', 'always',
  'often', 'sometimes', 'usually', 'never', 'ever', 'again', 'together', 'later', 'early', 'soon', 'already', 'yet', 'still',
  'very', 'really', 'so', 'just', 'well', 'hard', 'fast', 'late', 'home', 'abroad', 'outside', 'inside', 'upstairs', 'downstairs',
  'away', 'back', 'once', 'twice', 'underwater', 'abroad', 'downtown', 'high', 'far', 'low', 'deep', 'else', 'worse', 'farther', 'further', 'louder', 'slower', 'longer', 'harder', 'sooner', 'enough', 'much', 'more', 'most', 'best', 'better', 'faster', 'higher', 'highest', 'earlier',
  'first', 'finally', 'quite', 'almost', 'only', 'even', 'not', 'ago', 'everywhere', 'somewhere', 'anywhere', 'forever', 'sure',
  'tomorrow', 'all', 'lot', 'everyday', 'online', 'overseas', 'alone']);
const FREQ = new Set(['first', 'strongly', 'always', 'often', 'sometimes', 'usually', 'never', 'also', 'just', 'already', 'still', 'really', 'even', 'only', 'ever']);
const LINKING = new Set(['be', 'become', 'look', 'feel', 'smell', 'taste', 'sound', 'seem', 'appear', 'remain']);
const SOFT_LINK = new Set(['get', 'turn', 'grow', 'stay', 'keep', 'go', 'fall', 'come']);
const ADV_ALWAYS = new Set(['here', 'there', 'today', 'tomorrow', 'yesterday', 'tonight', 'now', 'home', 'abroad', 'everywhere', 'downtown', 'upstairs', 'downstairs', 'outside', 'inside', 'ago', 'together', 'too', 'also', 'again', 'underwater', 'everyday', 'straight', 'anymore', 'before', 'soon', 'later', 'maybe', 'luckily', 'unfortunately', 'suddenly', 'finally', 'instead', 'either', 'neither', 'indoors', 'outdoors', 'overseas', 'nearby']);
const ABBR = /^(mr|mrs|ms|dr|st|mt).$/i;
const TO_OBJ = new Set(['want', 'like', 'love', 'need', 'hope', 'plan', 'decide', 'start', 'begin', 'try', 'learn', 'wish', 'forget', 'remember', 'hate', 'prefer', 'promise', 'agree', 'choose', 'expect', 'would']);
const SUB = new Set(['because', 'if', 'while', 'although', 'though', 'unless', 'so', 'when', 'before', 'after', 'until', 'since', 'whenever', 'as']);
const CONJ = new Set(['and', 'or', 'but']);
const ING_ADJ = new Set(['exciting', 'interesting', 'boring', 'amazing', 'surprising', 'tiring', 'relaxing', 'shocking', 'confusing', 'disappointing', 'charming', 'annoying', 'frightening', 'terrifying', 'fascinating', 'embarrassing', 'satisfying', 'touching', 'outstanding', 'loving', 'caring', 'willing', 'missing', 'delicious', 'amusing', 'pleasing', 'thrilling', 'astonishing', 'refreshing', 'welcoming', 'striking', 'stunning']);
const INTENS = new Set(['very', 'so', 'too', 'really', 'quite', 'pretty', 'more', 'most', 'much', 'a little', 'extremely', 'super']);
const BE_ADJ = new Set(['late', 'early', 'sure', 'alone', 'well', 'ready', 'fine', 'free', 'right', 'wrong', 'awake', 'asleep', 'enough', 'better', 'best', 'busy', 'full', 'open', 'closed']);
const TIME_N = /^(day|days|week|weeks|month|months|year|years|morning|mornings|night|nights|evening|afternoon|weekend|weekends|time|summer|winter|spring|fall|autumn|semester|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mondays|tuesdays|wednesdays|thursdays|fridays|saturdays|sundays|january|february|march|april|may|june|july|august|september|october|november|december|christmas|holiday|holidays|vacation|class|lesson|hour|hours|minute|minutes|second|seconds|period|break|lunch|dinner|breakfast|noon|midnight|dawn|season|term)$/;
const ED_ADJ = new Set(['exhausted', 'tired', 'excited', 'bored', 'interested', 'scared', 'surprised', 'worried', 'pleased', 'satisfied', 'disappointed', 'embarrassed', 'confused', 'amazed', 'frightened', 'annoyed', 'relaxed', 'shocked', 'thrilled', 'delighted', 'stressed', 'married', 'crowded', 'closed', 'lost', 'finished', 'done', 'upset', 'excited', 'terrified', 'puzzled', 'impressed', 'ashamed', 'injured', 'hurt', 'broken', 'worn', 'filled', 'covered', 'dressed', 'prepared', 'located', 'gone']);
const PHRASAL = new Set(['pick up', 'hang up', 'put on', 'take off', 'put away', 'wake up', 'get up', 'set up', 'clean up', 'turn on', 'turn off', 'try on', 'give up', 'put out', 'eat out', 'hang out', 'run away', 'throw away', 'fill out', 'find out', 'figure out', 'write down', 'sit down', 'calm down', 'lie down', 'stand up', 'show up', 'come back', 'go back', 'give back', 'bring back', 'look up', 'grow up', 'cheer up', 'dress up', 'make up', 'take out', 'put down', 'get off', 'get on', 'go out', 'come out', 'work out', 'check out', 'fall down', 'pass away', 'stay up', 'blow out', 'cut down', 'turn down', 'turn up', 'look after', 'take care', 'come in', 'go away', 'keep up', 'catch up', 'pay back', 'put up', 'tidy up', 'line up', 'hurry up', 'speak up', 'warm up', 'clear up', 'mix up', 'pull out', 'break down', 'look around', 'move out', 'move in', 'sign up', 'drop off', 'set off', 'take away', 'run out', 'get out', 'went out', 'shut down', 'slow down', 'zoom out', 'zoom in', 'log in', 'fill up', 'use up', 'eat up', 'drink up', 'give away', 'tear down', 'knock down', 'put back', 'take back', 'fall off', 'jump up', 'come over', 'look over', 'get over', 'think over', 'hand out', 'hand in', 'turn in', 'stay in', 'sleep over']);
const THINK = new Set(['think', 'know', 'believe', 'hope', 'say', 'mean', 'guess', 'show', 'remember', 'forget', 'wish', 'notice', 'learn', 'understand', 'imagine', 'suppose', 'bet', 'realize', 'agree', 'decide', 'worry', 'wonder']);
const PERCEP = new Set(['see', 'watch', 'hear', 'feel', 'notice', 'let', 'make', 'have', 'help', 'listen', 'look']);
const SENSE = new Set(['look', 'feel', 'smell', 'taste', 'sound']);
const IRREG_PP = new Set(['been', 'gone', 'done', 'seen', 'had', 'made', 'read', 'eaten', 'drunk', 'written', 'taken', 'given', 'known', 'flown', 'ridden', 'swum', 'run', 'begun', 'broken', 'chosen', 'driven', 'fallen', 'forgotten', 'gotten', 'got', 'grown', 'heard', 'hidden', 'held', 'kept', 'left', 'lost', 'met', 'paid', 'put', 'said', 'sold', 'sent', 'shown', 'slept', 'spent', 'spoken', 'stolen', 'stood', 'sung', 'taught', 'thought', 'told', 'understood', 'won', 'worn', 'built', 'bought', 'brought', 'caught', 'found', 'felt', 'cut', 'hit', 'hurt', 'let', 'set', 'shut', 'become', 'come', 'sat', 'woken', 'drawn', 'blown', 'thrown', 'torn', 'shaken']);
const NUM_UNITS = /^(grams?|kilograms?|kg|tons?|meters?|centimeters?|cm|km|kilometers?|years?|months?|weeks?|days?|hours?|minutes?|seconds?|dollars?|won|times|pounds?|feet|inches?|liters?)$/;

const verbCache = new Map();
// 단어가 문맥상 동사로 쓰일 수 있는지 ("they ___" 에서 동사로 읽히는지)
function verbish(word) {
  const w = word.toLowerCase();
  if (!verbCache.has(w)) verbCache.set(w, nlp('they ' + w).terms().json()[1]?.terms?.[0]?.tags?.includes('Verb') || false);
  return verbCache.get(w);
}

function tokenize(sentence) {
  const out = [];
  // 하이픈 낱말(hide-and-seek)이 쪼개지지 않게 잠시 바꿔 둔다
  for (const s of nlp(sentence.replace(/([A-Za-z])-(?=[A-Za-z])/g, '$1_')).json()) {
    for (const t of s.terms) {
      const low = (t.implicit || t.text || '').replace(/_/g, '-').toLowerCase().replace(/[^a-z0-9'-]/g, '');
      out.push({
        text: t.text.replace(/_/g, '-'), implicit: t.implicit || '', w: low, tags: new Set(t.tags),
        pre: t.pre || '', post: t.post || '',
      });
    }
  }
  return out;
}

let OVERRIDES = {};
export function setOverrides(o) { OVERRIDES = o || {}; }
// 덩어리 표기 'S:He | V:should swim | M:faster.' → [{t,r}]
function parseOverride(str) {
  return str.split(' | ').map((p) => { const k = p.indexOf(':'); const t = p.slice(k + 1).trim(); return /^'/.test(t) ? { t, r: p.slice(0, k).trim(), g: 1 } : { t, r: p.slice(0, k).trim() }; });
}

export function analyze(sentence) {
  if (OVERRIDES[sentence]) return parseOverride(OVERRIDES[sentence]);
  return analyzeAuto(sentence);
}

function analyzeAuto(sentence) {
  const T = tokenize(sentence);
  const R = new Array(T.length).fill(null);
  const B = new Array(T.length).fill(false); // 여기서 새 덩어리 시작
  const has = (i, tag) => i < T.length && T[i].tags.has(tag);
  const w = (i) => (i < T.length ? T[i].w : '');
  const isVerbTag = (i) => has(i, 'Verb') && !has(i, 'Gerund') || (has(i, 'Verb') && has(i, 'Gerund'));
  const isAux = (i) => BE.has(w(i)) || DO.has(w(i)) || MODAL.has(w(i)) || HAVE.has(w(i));
  const commaAfter = (i) => /,/.test(T[i]?.post || '');
  let mainVerb = '';

  // 명사구를 i 부터 읽어 끝 다음 위치를 돌려준다
  function np(i, { allowAnd = false, expectBase = false } = {}) {
    const start = i;
    if (i >= T.length) return i;
    if (w(i) === 'her' && (has(i + 1, 'Determiner') || has(i + 1, 'Value') || ['some', 'a', 'an', 'the', 'my', 'his', 'two', 'three'].includes(w(i + 1)))) return i + 1;
    if (['this', 'that', 'these', 'those'].includes(w(i)) && verbish(T[i + 1]?.text || '') && /s$/.test(w(i + 1)) && (['that', 'me', 'us', 'you', 'him', 'her', 'them', 'it'].includes(w(i + 2)) || has(i + 2, 'Determiner') || has(i + 2, 'Possessive'))) return i + 1;
    if (has(i, 'Pronoun') && !has(i, 'Possessive')) {
      i++;
      if ((w(i) === 'all' || w(i) === 'both') && !commaAfter(i - 1)) i++;
    } else {
      let sawHead = false;
      while (i < T.length) {
        const x = w(i);
        if ((x === 'all' || x === 'both' || x === 'half') && !sawHead && (has(i + 1, 'Determiner') || has(i + 1, 'Possessive') || has(i + 1, 'Noun'))) { i++; continue; }
        if (x === 'no' && !sawHead && (has(i + 1, 'Noun') || has(i + 1, 'Adjective'))) { i++; continue; }
        if (x === 'such' && !sawHead && ['a', 'an'].includes(w(i + 1))) { i++; continue; }
        if (INTENS.has(x) && ED_ADJ.has(w(i + 1))) { i += 2; sawHead = true; continue; }
        if (INTENS.has(x) && (has(i + 1, 'Adjective') || has(i + 1, 'Comparative') || has(i + 1, 'Superlative'))) { i++; continue; }
        if (PREP.has(x) && x !== 'like' && !(x === 'of' && sawHead) && !(x === 'next' && w(i + 1) !== 'to')) break;
        if (i > start && ADV_ALWAYS.has(x)) break;
        if (x === 'of' && sawHead) { i++; sawHead = false; continue; } // a lot of milk, a family of zebras
        if (isAux(i) && sawHead) break;
        if (CONJ.has(x)) {
          if (allowAnd && sawHead) { i++; sawHead = false; continue; }
          break;
        }
        if (SUB.has(x) && sawHead) break;
        if (sawHead && (has(i, 'Determiner') || has(i, 'Possessive')) && !has(i - 1, 'Possessive')) break; // my friend | a ring
        if (sawHead && has(i, 'Verb') && !has(i, 'Noun') && !has(i, 'Adjective') && !has(i, 'Gerund')) break;
        if (sawHead && ADV_ALWAYS.has(x)) break;
        if (sawHead && /ing$/.test(x) && !['thing', 'something', 'anything', 'nothing', 'everything', 'king', 'ring', 'spring', 'building', 'ceiling', 'morning', 'evening', 'wing', 'swing', 'string', 'sibling', 'painting', 'ending', 'meeting'].includes(x) && !has(i - 1, 'Determiner') && !has(i - 1, 'Possessive')) break;
        if (sawHead && has(i, 'Adjective') && !has(i, 'Noun') && !has(i - 1, 'Possessive') && !has(i + 1, 'Noun')) break;
        if (!sawHead && has(i, 'Adverb') && !/ly$/.test(x) && (has(i + 1, 'Adjective') || has(i + 1, 'Noun')) && !MWORD.has(x)) { i++; continue; }
        if (!sawHead && i > start && (has(i - 1, 'Determiner') || has(i - 1, 'Possessive') || has(i - 1, 'Adjective')) && has(i, 'Verb') && !isAux(i) && !PREP.has(x)) { sawHead = true; i++; if (commaAfter(i - 1)) break; continue; }
        if (has(i, 'Determiner') || has(i, 'Possessive') || has(i, 'Value') || has(i, 'Adjective') || has(i, 'Noun') || has(i, 'Gerund')
          || x === 'a' || x === 'an' || x === 'the' || x === 'lots' || x === 'lot') {
          // 명사 뒤에 오는 동사형 단어는 동사로 돌린다 (How much does a lizard weigh?)
          if (sawHead && expectBase && verbish(T[i].text) && !has(i, 'Possessive')) break;
          if (sawHead && MWORD.has(x) && !has(i, 'Noun')) break;
          if (i > start && TIME_HEAD.has(x) && TIME_N.test(w(i + 1))) break;
          if (x === 'lot' || x === 'lots') sawHead = true;
          if ((has(i, 'Noun') && !(has(i, 'Adjective') && (has(i + 1, 'Noun') || has(i + 1, 'Adjective')))) || has(i, 'Pronoun') || has(i, 'Gerund') || (has(i, 'Value') && !has(i + 1, 'Adjective') && !has(i + 1, 'Noun'))) sawHead = true;
          if (has(i, 'Pronoun') && !has(i, 'Possessive')) { i++; break; }
          i++;
          if (commaAfter(i - 1)) break;
          continue;
        }
        break;
      }
    }
    return i === start ? start + 1 : i;
  }
  const mark = (a, b, r) => { for (let k = a; k < b && k < T.length; k++) R[k] = r; if (a < T.length) B[a] = true; };

  // 동사 덩어리: (조동사)(not)(빈도부사)동사(소사)
  function verbGroup(i, aux0 = '') {
    const s = i;
    let lastMain = aux0;
    while (i < T.length) {
      const x = w(i);
      if (x === 'not' || has(i, 'Negative')) { R[i] = 'V'; i++; continue; }
      if (DO.has(x) && i === s && aux0) break;
      if (DO.has(x) && i === s && (has(i + 1, 'Noun') || has(i + 1, 'Determiner') || has(i + 1, 'Possessive')) && !has(i + 1, 'Negative') && !has(i + 1, 'Pronoun')) break;
      if (isAux(i) && !(HAVE.has(x) && !isPerfect(i))) { R[i] = 'V'; lastMain = T[i].implicit || x; i++; continue; }
      if ((x === 'able' || x === 'going' || x === 'supposed') && w(i + 1) === 'to' && !has(i + 2, 'Determiner') && !has(i + 2, 'Possessive') && !has(i + 2, 'ProperNoun') && (x !== 'going' || verbish(T[i + 2]?.text || ''))) { R[i] = 'V'; R[i + 1] = 'V'; i += 2; lastMain = ''; continue; }
      if (FREQ.has(x) && i > s) { mark(i, i + 1, 'M'); i++; B[i] = true; continue; }
      break;
    }
    // 본동사 (be 뒤에서는 -ing·과거분사만)
    const afterBe = BE.has(lastMain) || lastMain === "'s" || lastMain === "'m" || lastMain === "'re";
    const gerundSubj = /hobby|activity|job|favorite|dream|goal|plan|wish|problem/i.test(T.filter((t, k) => R[k] === 'S').map((t) => t.w).join(' '));
    const beOk = !(afterBe && (ED_ADJ.has(w(i)) || (gerundSubj && /ing$/.test(w(i))))) && (!afterBe || (/ing$/.test(w(i)) && !ING_ADJ.has(w(i)) && !gerundSubj) || ((has(i, 'Gerund') || has(i, 'PastTense') || has(i, 'Participle') || /(ed|en|wn|ght)$/.test(w(i))) && !has(i, 'Adjective') && !has(i, 'Noun')));
    const afterDo = DO.has(lastMain) || MODAL.has(lastMain) || ["'ll", "'d"].includes(lastMain);
    if (afterDo && i < T.length && !R[i] && !has(i, 'Determiner') && !has(i, 'Pronoun') && !has(i, 'Possessive') && !(PREP.has(w(i)) && !verbish(T[i].text)) && !MWORD.has(w(i)) && !has(i, 'Adjective') || (afterDo && i < T.length && !R[i] && verbish(T[i].text) && !has(i, 'Determiner') && !has(i, 'Pronoun'))) {
      R[i] = 'V'; lastMain = x2lemma(i); i++;
      i = afterMain(i);
    } else if (HAVE.has(lastMain) && IRREG_PP.has(w(i))) {
      R[i] = 'V'; lastMain = x2lemma(i); i++;
      i = afterMain(i);
    } else if (w(i) === 'like' && R[i - 1] === 'S' && !lastMain) {
      R[i] = 'V'; lastMain = 'like'; i++;
    } else if (beOk && i < T.length && (has(i, 'Verb') || verbish(T[i].text)) && !(PREP.has(w(i)) && !has(i, 'Verb')) && !has(i, 'Determiner') && !has(i, 'Pronoun')) {
      R[i] = 'V'; lastMain = x2lemma(i); i++;
      i = afterMain(i);
    } else if (lastMain) {
      lastMain = BE.has(lastMain) ? 'be' : lastMain;
    }
    if (s < T.length) B[s] = true;
    mainVerb = lemma(lastMain);
    return i;

    function afterMain(i) {
      if (['have', 'has', 'had', 'used', 'ought'].includes(T[i - 1].w) && w(i) === 'to' && T[i + 1] && !has(i + 1, 'Determiner') && !has(i + 1, 'Possessive') && !has(i + 1, 'Pronoun')) { R[i] = 'V'; R[i + 1] = 'V'; lastMain = x2lemma(i + 1); i += 2; }
      const PART = ['up', 'down', 'off', 'away', 'out', 'back', 'on', 'over', 'around'];
      const pv = lastMain + ' ' + w(i);
      const objAfter = has(i + 1, 'Date') || TIME_N.test(w(i + 1)) || has(i + 1, 'ProperNoun') || has(i + 1, 'Determiner') || has(i + 1, 'Noun') || has(i + 1, 'Possessive') || has(i + 1, 'Pronoun') || has(i + 1, 'Value') || has(i + 1, 'Adjective');
      if (PART.includes(w(i)) && (PHRASAL.has(pv) || (!objAfter && !['go', 'come', 'run', 'walk', 'climb', 'jump'].includes(lastMain) && w(i + 1) !== 'to'))) { R[i] = 'V'; i++; }
      if (lastMain === 'go' && /ing$/.test(w(i))) { R[i] = 'V'; i++; }
      return i;
    }
  }
  function isPerfect(i) { if (w(i + 1) === 'to') return false; for (let k = i + 1; k < Math.min(T.length, i + 4); k++) { if (FREQ.has(w(k)) || has(k, 'Negative') || w(k) === 'not' || w(k) === 'never') continue; if (IRREG_PP.has(w(k))) return true; if (has(k, 'PastTense') || has(k, 'Participle') || /(ed|en|wn|ne|ft|ght|lt|pt|un|wum)$/.test(w(k)) && has(k, 'Verb')) return true; if (has(k, 'Determiner') || has(k, 'Noun') && !has(k, 'Pronoun')) return false; } return false; }
  function x2lemma(i) {
    const t = nlp('they ' + (T[i].implicit || T[i].text));
    const inf = t.verbs().toInfinitive().text().replace(/^they /, '');
    return (inf || T[i].w).toLowerCase();
  }
  function lemma(v) { return BE.has(v) || v === "'s" || v === "'m" || v === "'re" ? 'be' : v; }

  // 서술부(동사 뒤) 읽기
  function predicate(i, end) {
    // 명사절 목적어 (I think climbing is fun / It means you shouldn't eat here)
    if (THINK.has(mainVerb) && i < end) {
      let k = w(i) === 'that' ? i + 1 : i;
      const rest = T.slice(k, end);
      const vAt = rest.findIndex((t, n) => n > 0 && (isAux(k + n) || ((t.tags.has('PresentTense') || t.tags.has('PastTense')) && !t.tags.has('Gerund') && !t.tags.has('Noun') && !t.tags.has('Infinitive'))));
      if (vAt > 0 && !PREP.has(w(i)) && !has(i, 'Adjective')) { mark(i, end, 'O'); return end; }
    }
    while (i < end) {
      const x = w(i);
      if (R[i]) { i++; continue; }
      if (x === 'please') { mark(i, i + 1, 'X'); i++; continue; }
      if (x === 'the' && ['most', 'least', 'best'].includes(w(i + 1)) && (/ly$/.test(w(i + 2)) || i + 2 >= end || PREP.has(w(i + 2)) || has(i + 2, 'Adverb'))) { const j = /ly$/.test(w(i + 2)) || (has(i + 2, 'Adverb') && !PREP.has(w(i + 2))) ? i + 3 : i + 2; mark(i, j, 'M'); i = j; continue; }
      if (w(i + 1) === 'ago') { mark(i, i + 2, 'M'); i += 2; continue; }
      if (['several', 'many', 'few'].includes(x) && w(i + 1) === 'times') { mark(i, i + 2, 'M'); i += 2; continue; }
      if (x === 'all' && TIME_N.test(w(i + 1))) { const k = w(i + 2) === 'long' ? i + 3 : i + 2; mark(i, k, 'M'); i = k; continue; }
      // 부가의문문 (, isn't he?)
      if (i > 0 && commaAfter(i - 1) && isAux(i) && /[?]/.test(T[end - 1].post) && end - i <= 3) { mark(i, end, 'X'); return end; }
      // 5형식: 지각·사역동사 + 목적어 + 원형/-ing
      if (PERCEP.has(mainVerb) && R[i - 1] === 'O' && !PREP.has(x) && !has(i, 'Determiner') && !has(i, 'Possessive') && !has(i, 'Pronoun') && !has(i, 'Adjective') && !MWORD.has(x) && (verbish(T[i].text) || /ing$/.test(x))) {
        let j = i + 1;
        if (['up', 'off', 'out', 'down', 'on', 'away'].includes(w(j)) && !(has(j + 1, 'Pronoun') && !has(j + 1, 'Possessive'))) j++;
        if (j < end && (has(j, 'Determiner') || has(j, 'Possessive') || has(j, 'Noun') || has(j, 'Pronoun') || has(j, 'Value') || has(j, 'Adjective'))) j = np(j);
        mark(i, j, 'C'); i = j; continue;
      }
      if (['much', 'many', 'more', 'few', 'little', 'some', 'no', 'all', 'both'].includes(x) && (has(i + 1, 'Noun') || (has(i + 1, 'Determiner') && !TIME_HEAD.has(w(i + 1))))) { const j = np(i); mark(i, j, LINKING.has(mainVerb) ? 'C' : 'O'); i = j; continue; }
      if (INTENS.has(x) && (MWORD.has(w(i + 1)) || /ly$/.test(w(i + 1)) || (has(i + 1, 'Adverb') && !has(i + 1, 'Adjective'))) && !LINKING.has(mainVerb)) { let j = i + 2; while (j < end && (MWORD.has(w(j)) && !ADV_ALWAYS.has(w(j)))) j++; mark(i, j, 'M'); i = j; continue; }
      if (CONJ.has(x)) {
        mark(i, i + 1, 'J'); i++;
        if (i < end && (has(i, 'Pronoun') && !has(i, 'Possessive') && (isAux(i + 1) || has(i + 1, 'Verb') || FREQ.has(w(i + 1))) || (has(i, 'Determiner') && R.includes('S') && T.slice(i, end).some((t, k) => isAux(i + k))))) { const save = mainVerb; clause(i, end); mainVerb = save; return end; }
        const prevV = R.slice(0, i - 1).reverse().find((r) => r && r !== 'M') === 'V';
        const prevRole = R[i - 2];
        if (i < end && ((has(i, 'Verb') && !has(i, 'Gerund')) || isAux(i) || (prevV && verbish(T[i].text) && !has(i, 'Determiner')) || (R.includes('V') && verbish(T[i].text) && !has(i, 'Determiner') && !has(i, 'Pronoun') && (has(i + 1, 'Noun') || has(i + 1, 'Determiner') || has(i + 1, 'Possessive')) && !has(i, 'Adjective')))) { i = verbGroup(i); continue; }
        if (i < end && ['O', 'C', 'M'].includes(prevRole) && !PREP.has(w(i)) && !SUB.has(w(i)) && !has(i, 'Pronoun')) { const j = np(i); mark(i, j, prevRole); i = j; }
        continue;
      }
      if (SUB.has(x) && x !== 'so' && !(x === 'since' && !has(i + 1, 'Pronoun')) && !(['before', 'after', 'until'].includes(x) && !has(i + 1, 'Pronoun') && !has(i + 2, 'Verb'))) {
        mark(i, end, 'M'); return end;
      }
      if (x === 'so' && (has(i + 1, 'Pronoun') || has(i + 1, 'Noun'))) { mark(i, i + 1, 'J'); const save = mainVerb; clause(i + 1, end); mainVerb = save; return end; }
      if (x === 'to' && i + 1 < end && (has(i + 1, 'Infinitive') || (has(i + 1, 'Verb') && !has(i + 1, 'Noun')) || (TO_OBJ.has(mainVerb) && R[i - 1] === 'V' && !has(i + 1, 'Determiner') && !has(i + 1, 'Possessive') && !has(i + 1, 'ProperNoun')))) {
        // to부정사
        let j = i + 2;
        const r = TO_OBJ.has(mainVerb) && R[i - 1] === 'V' ? 'O' : 'M';
        while (j < end && !CONJ.has(w(j)) && !SUB.has(w(j)) && !(ADV_ALWAYS.has(w(j)) && j > i + 2) && !(TIME_HEAD.has(w(j)) && has(j + 1, 'Noun'))) j++;
        mark(i, j, r); i = j; continue;
      }
      if (['outside', 'inside', 'around', 'behind', 'below', 'above', 'over', 'along', 'near', 'by', 'past', 'off'].includes(x) && (i + 1 >= end || SUB.has(w(i + 1)) || CONJ.has(w(i + 1)) || commaAfter(i) || (PREP.has(w(i + 1)) && w(i + 1) !== 'of'))) { mark(i, i + 1, 'M'); i++; continue; }
      if (PREP.has(x) && !(x === 'like' && LINKING.has(mainVerb))) {
        let j = i + 1;
        if ((x === 'next' && w(j) === 'to') || (x === 'in' && w(j) === 'front') || (x === 'out' && w(j) === 'of')) j++;
        if (w(j) === 'of' && x === 'in') j++;
        if (j < end && !PREP.has(w(j))) j = np(j);
        else if (j < end && PREP.has(w(j))) j = np(j + 1);
        if (x === 'between' && w(j) === 'and') j = np(j + 1);
        mark(i, j, 'M'); i = j; continue;
      }
      if ((x === 'a' && w(i + 1) === 'lot') || (x === 'lots' && w(i + 1) === 'of')) { const j = np(i); mark(i, j, LINKING.has(mainVerb) ? 'C' : 'O'); i = j; continue; }
      if (['once', 'twice'].includes(x) || (has(i, 'Value') && w(i + 1) === 'times')) { let j = i + (x === 'once' || x === 'twice' ? 1 : 2); if ((w(j) === 'a' || w(j) === 'every' || w(j) === 'per') && TIME_N.test(w(j + 1))) j += 2; mark(i, j, 'M'); i = j; continue; }
      if (['left', 'right'].includes(x) && ['turn', 'go', 'move'].includes(mainVerb)) { mark(i, i + 1, 'M'); i++; continue; }
      if (SOFT_LINK.has(mainVerb) && ['better', 'worse', 'well', 'sick', 'asleep', 'ready', 'dark', 'old', 'wet'].includes(x)) { mark(i, i + 1, 'C'); i++; continue; }
      if (mainVerb === 'be' && BE_ADJ.has(x) && !R.slice(0, i).includes('C')) { mark(i, i + 1, 'C'); i++; continue; }
      if (has(i, 'Date') && mainVerb === 'be' && R[i - 1] === 'V' && !R.slice(0, i).includes('C')) { mark(i, i + 1, 'C'); i++; continue; }
      if (TIME_HEAD.has(x) && has(i + 1, 'Value') && TIME_N.test(w(i + 2))) { mark(i, i + 3, 'M'); i += 3; continue; }
      if (TIME_HEAD.has(x) && i + 1 < end && (TIME_N.test(w(i + 1)) || has(i + 1, 'Date')) && !(x === 'this' || x === 'that') || has(i, 'Date')) {
        let j = i + 1; while (j < end && (has(j, 'Noun') || has(j, 'Date') || has(j, 'Value')) && !PREP.has(w(j))) j++;
        mark(i, Math.max(j, i + 1), 'M'); i = Math.max(j, i + 1); continue;
      }
      if ((x === 'this' || x === 'that') && ['morning', 'afternoon', 'evening', 'weekend', 'week', 'year', 'summer', 'winter', 'spring', 'fall', 'time', 'month', 'saturday', 'sunday'].includes(w(i + 1))) {
        mark(i, i + 2, 'M'); i += 2; continue;
      }
      const intens = ['very', 'so', 'too', 'really', 'quite', 'pretty', 'more', 'most', 'much'].includes(x) && (has(i + 1, 'Adjective') || has(i + 1, 'Comparative') || has(i + 1, 'Superlative') || ED_ADJ.has(w(i + 1))) && (LINKING.has(mainVerb) || SOFT_LINK.has(mainVerb));
      const linkAdj = LINKING.has(mainVerb) && has(i, 'Adjective') && !ADV_ALWAYS.has(x);
      const preNom = linkAdj || has(i, 'Adverb') && !/ly$/.test(x) && !MWORD.has(x) && (has(i + 1, 'Adjective') || has(i + 1, 'Noun'));
      if (!intens && !preNom && (ADV_ALWAYS.has(x) || (MWORD.has(x) && !has(i, 'Noun')) || (has(i, 'Adverb') && !has(i, 'Adjective') && x !== 'there') || (/ly$/.test(x) && !has(i, 'Adjective') && !has(i, 'Noun')))) {
        let j = i + 1;
        while (j < end && (MWORD.has(w(j)) || (has(j, 'Adverb') && !has(j, 'Adjective'))) && !CONJ.has(w(j))) j++;
        // 보어 자리의 형용사·부사 비교급은 보어로
        mark(i, j, LINKING.has(mainVerb) && !R.slice(0, i).includes('C') && /(er|est|well|better|best|sure|alone)$/.test(x) && mainVerb === 'be' ? 'C' : 'M');
        i = j; continue;
      }
      if (has(i, 'Value') && NUM_UNITS.test(w(i + 1))) { const k = w(i + 2) === 'old' || w(i + 2) === 'long' || w(i + 2) === 'tall' ? i + 3 : i + 2; mark(i, k, LINKING.has(mainVerb) ? 'C' : 'O'); i = k; continue; }
      // 호칭 (, Mom?)
      if (i > 0 && commaAfter(i - 1) && (has(i, 'ProperNoun') || ['mom', 'dad', 'mommy', 'daddy', 'grandma', 'grandpa', 'sir', 'teacher', 'everyone', 'guys'].includes(x)) && np(i) >= end) { mark(i, end, 'X'); return end; }
      // 명사구·형용사
      const j = np(i);
      const isAdjOnly = T.slice(i, j).every((t) => t.tags.has('Adjective') || ['very', 'so', 'too', 'really', 'quite', 'pretty', 'more', 'most'].includes(t.w));
      let r;
      if (SENSE.has(mainVerb) && !isAdjOnly && !T.slice(i, j).some((t) => ED_ADJ.has(t.w))) r = 'O';
      else if (LINKING.has(mainVerb)) r = 'C';
      else if (SOFT_LINK.has(mainVerb) && j === i + 1 && ED_ADJ.has(w(i))) r = 'C';
      else if (SOFT_LINK.has(mainVerb) && (isAdjOnly || (j === i + 1 && (has(i, 'PastTense') || has(i, 'Participle'))))) r = 'C';
      else if (w(i) === 'the' && /est$/.test(w(i + 1)) && j === i + 2) r = 'M';
      else if (isAdjOnly && R.slice(0, i).includes('O')) r = 'C'; // 목적격 보어 (make me happy)
      else r = 'O';
      mark(i, j, r); i = j;
    }
    return i;
  }

  let i = 0;
  const N = T.length;
  // 문장이 둘(No, we aren't. We are at ...)이면 따로 분석
  const ends = [];
  T.forEach((t, k) => { if (/[.?!]/.test(t.post) && k < N - 1 && !ABBR.test(t.text + t.post.trim())) ends.push(k + 1); });

  function clause(i, end) {
    if (i >= end) return end;
    const start0 = i;
    // Because ~ 로 시작하는 대답
    if (w(i) === 'because' && !T.slice(i, end - 1).some((t) => /,/.test(t.post))) { mark(i, i + 1, 'J'); i++; return clause(i, end); }
    // Yes / No
    if (['yes', 'no', 'ok', 'okay', 'oh', 'wow', 'hey', 'hi', 'hello', 'well', 'sure', 'sorry', 'excuse'].includes(w(i)) && (commaAfter(i) || i + 1 === end || has(i, 'Expression'))) { mark(i, i + 1, 'X'); i++; }
    if (commaAfter(i) && (has(i, 'Noun') || has(i, 'ProperNoun')) && !has(i, 'Pronoun') && !has(i, 'Date') && i + 1 < end) { mark(i, i + 1, 'X'); i++; } // 호칭 (Students, ...)
    if (w(i) === 'please') { mark(i, i + 1, 'X'); i++; }
    // 감탄문 What a ...! / How ...! → 한 덩어리
    if (((w(i) === 'what' && (w(i + 1) === 'a' || w(i + 1) === 'an')) || (w(i) === 'how' && (has(i + 1, 'Adjective') || has(i + 1, 'Adverb') || /ing$/.test(w(i + 1))))) && /!/.test(T[end - 1].post)) { mark(i, end, 'X'); return end; }
    // 문두의 쉼표 앞 어구 (Luckily, / Last month, / All day long, / Instead of sleeping in,)
    { let c = -1; for (let k = i; k < Math.min(end - 1, i + 6); k++) if (commaAfter(k)) { c = k; break; }
      if (c >= i && !R[i] && !T.slice(i, c + 1).some((t, n) => isAux(i + n) || (t.tags.has('Verb') && !t.tags.has('Gerund') && !t.tags.has('Particle') && !PREP.has(t.w) && !t.tags.has('Noun') && !t.tags.has('Adjective')))) {
        if (!(c === i && (has(i, 'Noun') || has(i, 'ProperNoun')) && !has(i, 'Date') && !TIME_N.test(w(i)))) { mark(i, c + 1, 'M'); i = c + 1; } } }
    if (PREP.has(w(i)) && ['then', 'now', 'today', 'that'].includes(w(i + 1)) && (has(i + 2, 'Pronoun') || has(i + 2, 'Noun'))) { mark(i, i + 2, 'M'); i += 2; }
    if (['then', 'now', 'today', 'tomorrow', 'yesterday', 'tonight', 'later', 'soon'].includes(w(i)) && (has(i + 1, 'Pronoun') || has(i + 1, 'Determiner'))) { mark(i, i + 1, 'M'); i++; }
    if (['maybe', 'perhaps', 'luckily', 'sadly', 'suddenly', 'finally', 'unfortunately', 'actually'].includes(w(i))) { mark(i, i + 1, 'M'); i++; }
    // 감탄문 What a ...! / How ...!
    if ((w(i) === 'what' && (w(i + 1) === 'a' || w(i + 1) === 'an')) || (w(i) === 'how' && has(i + 1, 'Adjective') && /!/.test(T[end - 1].post))) {
      let j = i + 1;
      while (j < end && !has(j, 'Pronoun') && !(has(j, 'Determiner') && j > i + 2) && !isAux(j)) j++;
      if (j >= end) { mark(i, end, 'X'); return end; }
      mark(i, j, 'X');
      i = j;
    }
    // 앞에 오는 부사절 (When I was young, ...)
    if (SUB.has(w(i)) && w(i) !== 'so') {
      let j = i; while (j < end && !commaAfter(j)) j++;
      if (j < end - 1) { mark(i, j + 1, 'M'); i = j + 1; }
    }
    // 문두 부사(Soon, Today, ...)
    if ((MWORD.has(w(i)) || has(i, 'Date')) && commaAfter(i)) { mark(i, i + 1, 'M'); i++; }
    if (PREP.has(w(i)) && !WH.has(w(i))) { // In the morning, I ...
      let j = i; while (j < end && !commaAfter(j)) j++;
      if (j < end - 1) { mark(i, j + 1, 'M'); i = j + 1; }
    }
    if (w(i) === "let" || /^let's$/i.test(T[i].text)) {
      // Let's ~ : ~하자
      mark(i, i + 1, 'V');
      if (T[i + 1] && T[i + 1].text === '') { R[i + 1] = 'V'; i++; }
      i++;
      if (has(i, 'Pronoun') && T[i].text) { mark(i, i + 1, 'O'); i++; }
      const v0 = i;
      i = verbGroup(i);
      if (R[v0 - 1] === 'V') B[v0] = false; // Let's go = 한 덩어리
      return predicate(i, end);
    }

    if (PREP.has(w(i)) && WH.has(w(i + 1))) { mark(i, i + 2, 'W'); return question(i + 2, end); }
    // 의문사
    if (WH.has(w(i))) {
      let j = i + 1;
      while (j < end && !isAux(j) && !(has(j, 'Verb') && !has(j, 'Noun') && !has(j, 'Adjective')) && !has(j, 'Pronoun') && ['much', 'many', 'old', 'often', 'long', 'far', 'tall', 'big', 'kind', 'of', 'time', 'color', 'colour', 'day', 'season', 'sport', 'sports', 'animal', 'food', 'subject', 'fruit', 'size', 'shape', 'book', 'movie', 'one', 'way', 'class', 'month', 'grade', 'country', 'flavor', 'type', 'music', 'game', 'instrument', 'hobby', 'job'].includes(w(j))) j++;
      if (['what', 'which', 'whose'].includes(w(i))) while (j < end && has(j, 'Noun') && !has(j, 'Pronoun') && !isAux(j)) j++;
      // How much water / How many apples
      if (['much', 'many'].includes(w(j - 1)) && has(j, 'Noun') && !isAux(j)) j++;
      if (isAux(j)) {
        mark(i, j, 'W');
        return question(j, end);
      }
      // Who wipes the windows? — 의문사가 주어
      mark(i, j, 'W');
      i = verbGroup(j);
      return predicate(i, end);
    }
    // Yes/No 의문문
    if (isAux(i) && i === start0 && /[?]/.test(T[end - 1].post) && !has(i + 1, 'Negative')) return question(i, end);
    if (isAux(i) && (has(i + 1, 'Pronoun') || has(i + 1, 'Determiner') || has(i + 1, 'Noun') || has(i + 1, 'Possessive') || has(i + 1, 'Negative') || w(i + 1) === 'there')) {
      if (!(has(i + 1, 'Negative') && has(i + 2, 'Verb'))) return question(i, end);
    }
    // There is / are
    if ((w(i) === 'there' || w(i) === 'here') && isAux(i + 1)) {
      mark(i, i + 1, 'X');
      i = verbGroup(i + 1);
      const j = np(i);
      mark(i, j, 'S');
      return predicate(j, end);
    }
    // 명령문 (동사로 시작)
    if ((i === start0 || R[i - 1] === 'X' || R[i - 1] === 'M') && verbish(T[i].text) && !has(i, 'Determiner') && !has(i, 'Pronoun') && !has(i, 'Possessive') && !has(i, 'ProperNoun') && !isAux(i + 1) && !has(i + 1, 'PresentTense') && !has(i + 1, 'PastTense') && /[!.]/.test(T[end - 1].post) && !/s$/.test(w(i)) && !/ing$/.test(w(i)) && !(verbish(T[i + 1]?.text || '') && /s$/.test(w(i + 1)) && !has(i + 1, 'Determiner') && !ADV_ALWAYS.has(w(i + 1)))) {
      i = verbGroup(i);
      return predicate(i, end);
    }
    if ((has(i, 'Imperative') || (has(i, 'Infinitive') && !has(i, 'Noun'))) && !has(i, 'Pronoun') || (DO.has(w(i)) && has(i + 1, 'Negative'))) {
      i = verbGroup(i);
      return predicate(i, end);
    }
    // 평서문: 주어 → 동사 → 서술부
    let sEnd = np(i, { allowAnd: true });
    while (PREP.has(w(sEnd)) && w(sEnd) !== 'like' && T.slice(sEnd, end).some((t, n) => isAux(sEnd + n) || (t.tags.has('Verb') && !t.tags.has('Noun')))) { const e2 = np(sEnd + 1); if (e2 <= sEnd + 1 && !has(sEnd + 1, 'Noun')) break; sEnd = e2; }
    if (['here', 'there'].includes(w(sEnd)) && isAux(sEnd + 1) && sEnd > i) sEnd++;
    mark(i, sEnd, 'S');
    i = sEnd;
    while (i < end && (FREQ.has(w(i)) || (has(i, 'Adverb') && !isAux(i) && !has(i, 'Verb')))) { mark(i, i + 1, 'M'); i++; }
    i = verbGroup(i);
    return predicate(i, end);
  }

  // 조동사 + 주어 + (동사) + ...
  function question(i, end) {
    const auxW = T[i].implicit || w(i);
    R[i] = 'V'; B[i] = true; i++;
    if (has(i, 'Negative')) { R[i] = 'V'; i++; }
    if (w(i) === 'there') { mark(i, i + 1, 'X'); i++; if (PREP.has(w(i)) || i >= end) { mainVerb = 'be'; return predicate(i, end); } const j = np(i); mark(i, j, 'S'); mainVerb = 'be'; return predicate(j, end); }
    if (!BE.has(auxW) && R.includes('W') && (has(i, 'Infinitive') || (has(i, 'Verb') && !has(i, 'Noun'))) && !has(i, 'Pronoun') && !has(i, 'Determiner') && !(verbish(T[i + 1]?.text || '') && !has(i + 1, 'Determiner') && !has(i + 1, 'Pronoun') && i + 1 < end)) { const v0 = i; i = verbGroup(i, auxW); B[v0] = false; return predicate(i, end); }
    if ((BE.has(auxW) || auxW === "'s") && R.includes('W') && ((/ing$/.test(w(i)) && !ING_ADJ.has(w(i))) || ((has(i, 'PastTense') || has(i, 'Participle') || IRREG_PP.has(w(i)) || /ed$/.test(w(i))) && !ED_ADJ.has(w(i)) && !has(i, 'Pronoun')))) { R[i] = 'V'; i++; mainVerb = x2lemma(i - 1); return predicate(i, end); }
    const sEnd = np(i, { allowAnd: true, expectBase: !BE.has(auxW) && auxW !== "'s" });
    mark(i, sEnd, 'S');
    i = sEnd;
    if (BE.has(auxW) || auxW === "'s") {
      mainVerb = 'be';
      const s0 = R.indexOf('S');
      if (!R.includes('W') && ['this', 'that', 'these', 'those'].includes(T[s0]?.w) && sEnd >= end && sEnd - s0 > 1) { for (let k = s0 + 1; k < sEnd; k++) R[k] = 'C'; B[s0 + 1] = true; return end; }
      if ((has(i, 'Gerund') || has(i, 'PastTense') || has(i, 'Participle') || (/ing$/.test(w(i)) && !ING_ADJ.has(w(i)))) && !ED_ADJ.has(w(i))) { const v0 = i; i = verbGroup(i, 'be'); if (!R[v0]) { R[v0] = 'V'; B[v0] = true; i = Math.max(i, v0 + 1); } }
      return predicate(i, end);
    }
    while (i < end && FREQ.has(w(i))) { mark(i, i + 1, 'M'); i++; }
    i = verbGroup(i, auxW);
    return predicate(i, end);
  }

  let start = 0;
  for (const e of [...ends, N]) { clause(start, e); start = e; }
  for (let k = 0; k < N; k++) if (!R[k]) R[k] = 'M';
  if (!R.includes('V')) for (let k = 0; k < N; k++) if (R[k] !== 'W') R[k] = 'X';

  // 표면 글자로 되돌리며 덩어리로 묶기
  const chunks = [];
  for (let k = 0; k < N; k++) {
    const t = T[k];
    let text = t.pre.replace(/\s+/g, '') + t.text; // pre 의 따옴표 등
    // 축약형: It's → It + 's
    if (t.text && T[k + 1] && T[k + 1].text === '' && R[k] !== R[k + 1]) {
      const m = t.text.match(/^(.*?)('(?:s|m|re|ll|ve|d)|’(?:s|m|re|ll|ve|d))$/i);
      if (m) {
        push(m[1], R[k], B[k]);
        push(m[2] + t.post.trim(), R[k + 1], true, true);
        k++;
        continue;
      }
    }
    if (!t.text) { if (t.post.trim() && chunks.length) chunks[chunks.length - 1].t += t.post.trim(); continue; } // 축약의 숨은 절반
    push(text + t.post.replace(/\s+$/, ''), R[k], B[k]);
  }
  function push(text, r, boundary, glue = false) {
    const last = chunks[chunks.length - 1];
    if (last && last.r === r && !boundary) last.t += (glue ? '' : ' ') + text;
    else chunks.push({ t: text, r, glue });
  }
  // 덩어리 끝 문장부호 정리
  for (const c of chunks) c.t = c.t.trim();
  return chunks.map((c) => (c.glue ? { t: c.t, r: c.r, g: 1 } : { t: c.t, r: c.r }));
}

export const ROLE_KO = { W: '의문사', S: '주어', V: '동사', O: '목적어', C: '보어', M: '수식어', J: '접속사', X: '기타' };
export function show(chunks) { return chunks.map((c) => `[${c.r} ${c.t}]`).join(' '); }

if (process.argv[1] && process.argv[1].endsWith('analyze.mjs') && process.argv[2]) {
  console.log(show(analyze(process.argv.slice(2).join(' '))));
}
