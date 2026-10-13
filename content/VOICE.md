# VOICE.md: how GeoDex talks

Applies to hooks, facts, flag notes, contrast text, templates, and streak, stats and summary copy, in both English and Norwegian. Read it in full before writing any batch.

The voice: direct, dense, concrete, true. Hooks can be vivid, absurd or dry-funny. Facts are always literally correct. Nothing fills space, flatters, or decorates. A line either helps the learner retrieve the answer next time or teaches something specific and checkable. If it does neither, cut it.

## Reader

Someone who wants to actually remember. Smart, busy, reviewing between other things. They get information when they're right and a clear correction when they're wrong. No cheering in either case.

## Rules (both languages)

1. **Concrete over abstract.** Name neighbors, directions, coasts, shapes, colors. "Laos sits between Thailand and Vietnam" beats "Laos is a Southeast Asian nation."
2. **No adjective-only claims.** If a word only praises or vaguely describes, delete it. Banned lists are in the machine-checkable section. "Only" is allowed when the line says what it is the only one of.
3. **One idea per line.**
4. **No filler openers** ("Did you know", "Visste du at" and the rest of the banned list).
5. **No praise, no apology, no exclamation marks.**
6. **No em dashes or en dashes.** Use commas, colons, periods, parentheses. This includes the Norwegian tankestrek.
7. **Second person when addressing the learner** ("You picked Slovakia", "Du valgte Slovakia"). Otherwise plain declarative statements.
8. **Numbers come from data.** Use template slots for area, population, distance. A hand-written number or date in a fact needs a `sourceUrl`.
9. **Truth first.** If a popular mnemonic or fact is false, don't use it. If a myth is common enough to cause errors, correct it explicitly.
10. **Plain words.** If a term is needed (landlocked/innlandsstat, enclave/enklave, archipelago/øygruppe), define it in the same line the first time it appears in an entity's content.

## Tone

- **Vivid and absurd images are encouraged**, especially in `sound` and `story` hooks. A ridiculous, specific picture sticks better than a sensible vague one.
- **Dry humor is allowed** in hooks and facts: understatement, deadpan comparison. The framing can be funny; the claim must stay exactly true.
- **Mix per entity, per language:** at least 1 vivid or absurd hook, and at least 1 plain hook (`anchor`, `etymology` or `contrast`). If every hook is absurd, they blur together and stop working.
- **Never** humor at a people's or culture's expense, national or ethnic stereotypes, or jokes about wars, disasters, colonial violence or atrocities. Conflict appears only when historically central, phrased neutrally.

## Hook types

Each entity needs at least 3 hooks across at least 2 types, in each language. Mixing mechanisms matters: when one fails on a lapse, the engine switches to a different type.

| Type | What it does | English | Norsk |
|---|---|---|---|
| `anchor` | Places it relative to something already known | "Andorra sits in the Pyrenees between France and Spain." | "Andorra ligger i Pyreneene mellom Frankrike og Spania." |
| `shape` | The outline as an object, only if real at world zoom | "Italy is a boot kicking Sicily." | "Italia er en støvel som sparker Sicilia." |
| `etymology` | What the name means, when it carries a cue | "Ecuador is Spanish for equator, and the line runs through it." | "Ecuador er spansk for ekvator, og linjen går gjennom landet." |
| `sound` | Keyword method: a sound-alike tied to a vivid image | "Tbilisi: 'tea, Bill, see?' Bill pours tea in Georgia." | "Kairo: ro inn til kaia ved Nilen i Egypt." |
| `story` | Compressed cause and effect | "Canberra exists because Sydney and Melbourne each refused to let the other be capital." | "Canberra finnes fordi verken Sydney eller Melbourne ville la den andre bli hovedstad." |
| `flag_decode` | What the elements are, tied to the country | "Japan's red disc is the sun, as in 'land of the rising sun'." | "Japans røde sirkel er solen, som i «den oppgående sols land»." |
| `contrast` | The single feature that separates it from its look-alike | "Slovenia touches the sea and Italy. Slovakia is landlocked." | "Slovenia har kyst og grenser til Italia. Slovakia har ingen kyst." |

The English and Norwegian columns above happen to match in meaning, but they do not have to. Sound-alike and wordplay hooks are written natively per language: "Kairo" works as kai + ro only in Norwegian, and an English pun translated into Norwegian usually dies.

What makes a hook work:
- It links the cue to the answer. A hook that only makes sense once you already know the answer is useless.
- Known things anchor unknown things. Prefer neighbors and places most people already know.
- The pun must work on the name as written in that language ("Tyskland" in Norwegian, "Germany" in English).

## Fact tiers

- **Tier 1, orientation:** where it is, what borders it, coast or landlocked.
- **Tier 2, context:** the story behind the capital, a major river, a landmark, the currency's name origin.
- **Tier 3, deep cut:** surprising, true, and checkable. Shown only after mastery. Dry humor fits well here: "Monaco is smaller than New York's Central Park." / "Monaco er mindre enn Central Park i New York."

## Examples

| Bad | Problem | Good |
|---|---|---|
| "Bratislava is a charming capital with a rich history!" | Adjective-only, exclamation | "Bratislava touches two other countries: Austria and Hungary." |
| "Bratislava er en sjarmerende hovedstad med rik historie!" | Same | "Bratislava grenser til to andre land: Østerrike og Ungarn." |
| "Fun fact: Mongolia is huge." | Filler opener, vague | "Mongolia borders exactly two countries: Russia and China." |
| "Chad's flag is blue, yellow and red." | Describes, doesn't discriminate | "Chad and Romania share blue, yellow and red stripes. Chad's blue is darker." |
| "Tsjads flagg er blått, gult og rødt." | Same | "Tsjad og Romania har begge blå, gule og røde striper. Tsjads blå er mørkere." |
| "Nigeria, not to be confused with Niger." | No cue to tell them apart | "Nigeria has the coast and the longer name. Niger is landlocked, to its north." |
| "The Great Wall can be seen from space." | False | "The Great Wall is not visible to the naked eye from the Moon." |
| "Great job! That's right!" / "Bra jobba!" | Praise, no information | "{target.name} is {target.sizeVsHome}." |
| "Oops, not quite. Better luck next time." | Apology tone, no correction | "You picked {chosen.name}. {target.name} is the one bordering {target.knownNeighbor}." |

## Norwegian specifics

- Bokmål only.
- Country names follow `data/countries.json` (Wikidata nb, cross-checked with Språkrådet). Never invent a Norwegian name.
- Prepositions come from `prepNb`: "i Laos", "på Island", "på Cuba". Templates use `{target.inName}`, never a hardcoded "i".
- Number formatting comes from slots (space as thousands separator, decimal comma). Never format numbers by hand.
- Quotation marks: « ».
- Plain, modern Norwegian. No anglicisms where a common Norwegian word exists.

## Templates

Same rules. Additionally:
- A template must read correctly with every possible slot value. Test the extremes (Monaco and Russia for size, the home country itself, a "på" country in Norwegian).
- Prefer templates that use what the learner already knows: `target.knownNeighbor`, `home.*`.
- One sentence block per template. The screen shows at most 60 words of moment content.
- Every template id exists in both `en/` and `nb/`.

## Self-check before committing a batch

- Would this line help someone who just got it wrong get it right next time?
- Is every claim checkable?
- Per entity, per language: at least 3 hooks, at least 2 types, at least 1 vivid and 1 plain?
- Any banned word, dash, exclamation mark, or unsourced hand-written number?
- Do the Norwegian hooks work in Norwegian, or are they translated English puns?

## Machine-checkable rules (enforced by `pnpm content:lint`)

```yaml
locales: [en, nb]
max_length:
  hook: 140
  capital_hook: 140
  fact: 200
  flag_note: 160
  contrast: 160
  template_body: 320
banned_characters: ["\u2014", "\u2013", "!"]
banned_phrases:
  en:
    - "did you know"
    - "fun fact"
    - "interestingly"
    - "it's worth noting"
    - "believe it or not"
    - "remember that"
    - "note that"
    - "great job"
    - "well done"
  nb:
    - "visste du at"
    - "morsomt faktum"
    - "interessant nok"
    - "det er verdt å merke seg"
    - "tro det eller ei"
    - "husk at"
    - "merk at"
    - "bra jobba"
    - "godt jobbet"
banned_words:
  en: [beautiful, stunning, charming, vibrant, fascinating, diverse, iconic, breathtaking, renowned, "rich history"]
  nb: [vakker, nydelig, sjarmerende, fascinerende, mangfoldig, ikonisk, fantastisk, enestående, pulserende, "rik historie"]
digits_require_source: true            # any digit in a fact requires sourceUrl
min_hooks_per_entity_per_locale: 3
min_hook_types_per_entity_per_locale: 2
require_plain_hook_per_locale: true    # at least one of anchor, etymology, contrast
min_capital_hooks_per_country_per_locale: 2
min_facts_per_entity: 3
facts_require_both_locales: true
template_ids_match_across_locales: true
no_duplicate_text: true                # across all entities, per locale
template_body_forbids: ["---"]
hardcoded_nb_preposition: "\\bi {target"  # flag "i {target.name}" in nb templates; use {target.inName}
```
