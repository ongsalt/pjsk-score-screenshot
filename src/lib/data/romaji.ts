// Kana -> romaji, so a jp-server song can be found by typing latin letters.
// The music database gives us `pronunciation` in kana, which is the only
// reliable reading source - the title itself is kanji we cannot pronounce.

const BASE: Record<string, string> = {
  あ: "a", い: "i", う: "u", え: "e", お: "o",
  か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko",
  が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go",
  さ: "sa", し: "shi", す: "su", せ: "se", そ: "so",
  ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo",
  た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to",
  だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do",
  な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no",
  は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho",
  ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo",
  ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po",
  ま: "ma", み: "mi", む: "mu", め: "me", も: "mo",
  や: "ya", ゆ: "yu", よ: "yo",
  ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro",
  わ: "wa", ゐ: "wi", ゑ: "we", を: "o", ん: "n",
  ゔ: "vu",
  ぁ: "a", ぃ: "i", ぅ: "u", ぇ: "e", ぉ: "o",
  ゃ: "ya", ゅ: "yu", ょ: "yo", ゎ: "wa",
};

/** kana that swallow a following small vowel: きゃ, しゅ, ふぁ, てぃ … */
const COMPOUND: Record<string, string> = {
  きゃ: "kya", きゅ: "kyu", きょ: "kyo", きぇ: "kye",
  ぎゃ: "gya", ぎゅ: "gyu", ぎょ: "gyo",
  しゃ: "sha", しゅ: "shu", しょ: "sho", しぇ: "she",
  じゃ: "ja", じゅ: "ju", じょ: "jo", じぇ: "je",
  ちゃ: "cha", ちゅ: "chu", ちょ: "cho", ちぇ: "che",
  ぢゃ: "ja", ぢゅ: "ju", ぢょ: "jo",
  にゃ: "nya", にゅ: "nyu", にょ: "nyo",
  ひゃ: "hya", ひゅ: "hyu", ひょ: "hyo",
  びゃ: "bya", びゅ: "byu", びょ: "byo",
  ぴゃ: "pya", ぴゅ: "pyu", ぴょ: "pyo",
  みゃ: "mya", みゅ: "myu", みょ: "myo",
  りゃ: "rya", りゅ: "ryu", りょ: "ryo",
  ふぁ: "fa", ふぃ: "fi", ふぇ: "fe", ふぉ: "fo", ふゅ: "fyu",
  てぃ: "ti", てゅ: "tyu", でぃ: "di", でゅ: "dyu",
  とぅ: "tu", どぅ: "du",
  うぃ: "wi", うぇ: "we", うぉ: "wo",
  ゔぁ: "va", ゔぃ: "vi", ゔぇ: "ve", ゔぉ: "vo",
  つぁ: "tsa", つぃ: "tsi", つぇ: "tse", つぉ: "tso",
  しぃ: "shi", いぇ: "ye",
};

const SMALL_TSU = "っ";
const PROLONG = "ー";

/** katakana share the table with hiragana, one code block apart */
function toHiragana(text: string) {
  return text.replace(/[ァ-ヶ]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0x60),
  );
}

export function kanaToRomaji(input: string): string {
  const kana = toHiragana(input.normalize("NFKC"));
  let out = "";
  let pendingDouble = false;

  for (let i = 0; i < kana.length; i++) {
    const char = kana[i];

    if (char === SMALL_TSU) {
      // sokuon doubles whatever consonant comes next
      pendingDouble = true;
      continue;
    }

    if (char === PROLONG) {
      // long vowel mark repeats the vowel we just wrote
      const last = out.at(-1);
      if (last && "aiueo".includes(last)) out += last;
      continue;
    }

    const pair = COMPOUND[char + (kana[i + 1] ?? "")];
    let romaji = pair ?? BASE[char];
    if (pair) i += 1;

    if (romaji === undefined) {
      // latin, digits and punctuation ride through untouched
      out += char;
      pendingDouble = false;
      continue;
    }

    if (pendingDouble) {
      romaji = (romaji[0] === "c" ? "t" : romaji[0]) + romaji;
      pendingDouble = false;
    }

    out += romaji;
  }

  return out;
}

/**
 * Fold the spellings people actually type. Hepburn and kunrei disagree on half
 * the syllabary (shi/si, tsu/tu, ja/zya) and nobody types long vowels
 * consistently, so both the index and the query get flattened through this.
 */
export function looseRomaji(input: string): string {
  return input
    .toLowerCase()
    // ō / ê / ū decompose so the vowel survives being stripped of its accent
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .replace(/sh/g, "s")
    .replace(/ch/g, "t")
    .replace(/ts/g, "t")
    .replace(/j/g, "z")
    .replace(/f/g, "h")
    // kunrei spells the y that hepburn drops: zya = ja, sya = sha, tya = cha
    .replace(/([sztd])y/g, "$1")
    .replace(/wo/g, "o")
    .replace(/nn/g, "n")
    // long vowels: tōkyō, toukyou, tokyo all collapse to the same key
    .replace(/([aiueo])\1+/g, "$1")
    .replace(/ou/g, "o")
    .replace(/ei/g, "e");
}

/** true when the query is worth matching against the romaji index at all */
export function isLatin(input: string) {
  return /[a-z]/i.test(input);
}
