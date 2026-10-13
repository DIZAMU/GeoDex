---
id: lapse.location.chosen
moment: lapse
cardTypes: [map_to_name, name_to_map]
requires: [chosen]
---
You knew this one before. You picked {chosen.name}; {target.name} is in {target.subregion}{?target.neighborsText:, next to {target.neighborsText}}.
---
id: lapse.location
moment: lapse
cardTypes: [map_to_name, name_to_map, flag_to_name, name_to_flag]
---
You knew this one before. {target.name} is in {target.subregion}{?target.knownNeighbor:, beside {target.knownNeighbor}}.
---
id: lapse.capital
moment: lapse
cardTypes: [country_to_capital, capital_to_country]
---
You knew this one before. The capital of {target.name} is {target.capital}.
---
id: lapse.currency
moment: lapse
cardTypes: [country_to_currency]
---
You knew this one before. The currency {target.inName} is {target.currency}.
---
id: lapse.language
moment: lapse
cardTypes: [country_to_language]
---
You knew this one before. An official language {target.inName} is {target.language}.
