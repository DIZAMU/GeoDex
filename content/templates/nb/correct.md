---
id: correct.size
moment: correct
requires: [home]
---
{target.name} er {target.sizeVsHome}.
---
id: correct.population
moment: correct
requires: [home]
---
{target.name} har {target.popVsHome}.
---
id: correct.distance
moment: correct
requires: [home]
when: target.distanceFromHomeKm > 300
---
{target.name} ligger {target.distanceFromHome} {target.directionFromHome} for {home.name}.
---
id: correct.region
moment: correct
cardTypes: [map_to_name, name_to_map, flag_to_name, name_to_flag]
---
{target.name} hører til regionen {target.subregion}.
---
id: correct.landlocked
moment: correct
cardTypes: [map_to_name, name_to_map]
when: target.landlocked == true
---
{target.name} er en innlandsstat: landet har ingen kyst.
---
id: correct.capital
moment: correct
cardTypes: [country_to_capital, capital_to_country]
---
{target.capital} er hovedstaden {target.inName}.
---
id: correct.currency
moment: correct
cardTypes: [country_to_currency]
---
{target.currency} er valutaen {target.inName}.
---
id: correct.language
moment: correct
cardTypes: [country_to_language]
---
{target.language} er et offisielt språk {target.inName}.
