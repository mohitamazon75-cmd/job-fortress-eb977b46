// ═══════════════════════════════════════════════════════════════
// Stopwords for resume / JD matching
//
// Source: union of NLTK english stopwords + resume-matcher canonical
// stoplist + JobBachao-specific noise tokens (boilerplate words that
// dominate resumes/JDs without carrying signal: "experience", "year",
// "team", "work", etc.).
//
// We deliberately KEEP common skill-adjacent words ("data", "design",
// "build") — those are signal in this domain, not noise.
// ═══════════════════════════════════════════════════════════════

export const STOPWORDS = new Set<string>([
  // articles / determiners
  "a", "an", "the", "this", "that", "these", "those",
  // pronouns
  "i", "me", "my", "mine", "myself", "we", "our", "ours", "ourselves",
  "you", "your", "yours", "yourself", "yourselves",
  "he", "him", "his", "himself", "she", "her", "hers", "herself",
  "it", "its", "itself", "they", "them", "their", "theirs", "themselves",
  // be / have / do
  "am", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "having",
  "do", "does", "did", "doing", "done",
  // modals
  "will", "would", "shall", "should", "can", "could", "may", "might", "must",
  // conjunctions / prepositions
  "and", "but", "or", "if", "because", "as", "until", "while",
  "of", "at", "by", "for", "with", "about", "against", "between",
  "into", "through", "during", "before", "after", "above", "below",
  "to", "from", "up", "down", "in", "out", "on", "off", "over", "under",
  "again", "further", "then", "once",
  // common adverbs
  "here", "there", "when", "where", "why", "how",
  "all", "any", "both", "each", "few", "more", "most", "other",
  "some", "such", "no", "nor", "not", "only", "own", "same",
  "so", "than", "too", "very", "just", "now",
  // resume / JD boilerplate noise (high-frequency, low-signal in this domain)
  "experience", "experienced", "year", "years", "yr", "yrs",
  "month", "months", "day", "days", "week", "weeks",
  "work", "working", "worked", "works",
  "team", "teams", "company", "companies", "organization", "organisation",
  "role", "roles", "position", "positions", "job", "jobs",
  "responsible", "responsibility", "responsibilities",
  "include", "includes", "included", "including",
  "use", "uses", "used", "using",
  "able", "ability",
  "good", "great", "strong", "excellent",
  "new", "various", "different",
  "etc", "ie", "eg", "vs", "via",
  "also", "well", "much", "many",
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "first", "second", "third",
  // contractions stripped of apostrophes
  "dont", "doesnt", "didnt", "wont", "wouldnt", "shouldnt", "couldnt",
  "isnt", "arent", "wasnt", "werent", "havent", "hasnt", "hadnt",
  "im", "ive", "id", "ill", "youre", "youve", "youll", "hes", "shes",
  "weve", "well", "theyre", "theyve", "theyll",
]);

export function isStopword(token: string): boolean {
  return STOPWORDS.has(token.toLowerCase());
}
