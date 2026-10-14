# Phase 9: history layer

Former names, dissolved states and empires, with a view of borders over time in the Atlas.

Features
- 28 former names (Zaire, Ceylon, Siam, Persia, Burma, Gold Coast, Rhodesia, Dutch East Indies and more): "What is it called today?"
- 8 dissolved states (Soviet Union, Yugoslavia, Czechoslovakia, East and West Germany, Austria-Hungary, Gran Colombia, United Arab Republic): name the outline, and pick a country that was part of it
- 19 empires (Roman, Byzantine, Mongol, Ottoman, Achaemenid, Maurya, Mughal, Qing, Khmer, Mali, Songhai, Ghana, Inca, Aztec, Han, Carolingian, British, Spanish, Russian): name the outline, and say when it existed
- Every outline shows the year it represents, and "approximate" where it is drawn by hand or from modern borders that only roughly match
- A wrong era answer shows the period you picked, not the empire it belongs to
- "Which was part of it" never offers a country that was only partly inside, and "Macedonia" never offers Greece
- A former name starts with its country, a dissolved state once half its successors are started, an empire once a third of the countries it covers are
- Off by default: turn on History in Settings

Atlas and stats
- Borders over time: a year slider shows every outline whose period includes the year, each with its own year. View only
- Country pages list the former names, states and empires they belong to, with your level
- Stats shows a History row per continent when the module is on

Data
- Neither candidate dataset was usable: CShapes 2.0 is non-commercial share-alike and the historical basemaps are GPL. Dissolved states are drawn from their successors' Natural Earth shapes, empires from hand-simplified outlines clipped to land (DECISIONS.md 037)

Content
- Hooks and facts for every entity in English and Norwegian, written per language, listed in REVIEW.md for checking

Tests: unit tests for the data, the plan, every history card and the timeline; end-to-end proof that every outline shows its year and its approximate label, on the timeline and in a session, on desktop and phone, plus screenshots in every theme and language.
