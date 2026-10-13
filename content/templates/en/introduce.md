---
id: introduce.region
moment: introduce
---
{target.name} is in {target.subregion}{?target.neighborsText:, bordering {target.neighborsText}}.
---
id: introduce.island
moment: introduce
when: target.neighborCount == 0
---
{target.name} has no land border with any country. Find it in {target.subregion}.
---
id: introduce.home
moment: introduce
requires: [home]
when: target.distanceFromHomeKm > 300
---
{target.name} is {target.distanceFromHome} {target.directionFromHome} of {home.name}, and {target.sizeVsHome}.
---
id: introduce.capital
moment: introduce
---
{target.name} is in {target.subregion}. Its capital is {target.capital}.
