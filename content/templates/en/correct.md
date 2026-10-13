---
id: correct.size
moment: correct
requires: [home]
---
{target.name} is {target.sizeVsHome}.
---
id: correct.population
moment: correct
requires: [home]
---
{target.name} has {target.popVsHome}.
---
id: correct.distance
moment: correct
requires: [home]
when: target.distanceFromHomeKm > 300
---
{target.name} is {target.distanceFromHome} {target.directionFromHome} of {home.name}.
---
id: correct.region
moment: correct
cardTypes: [map_to_name, name_to_map, flag_to_name, name_to_flag]
---
{target.name} is in {target.subregion}.
---
id: correct.landlocked
moment: correct
cardTypes: [map_to_name, name_to_map]
when: target.landlocked == true
---
{target.name} is landlocked: it has no coastline.
---
id: correct.capital
moment: correct
cardTypes: [country_to_capital, capital_to_country]
---
{target.capital} is the capital of {target.name}.
---
id: correct.currency
moment: correct
cardTypes: [country_to_currency]
---
{target.currency} is the currency {target.inName}.
---
id: correct.language
moment: correct
cardTypes: [country_to_language]
---
{target.language} is an official language {target.inName}.
