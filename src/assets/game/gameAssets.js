export const cardBackImage = new URL("./cards/card-back.png", import.meta.url)
  .href;
export const prisonerPawnImage = new URL("./prisoner-pawn.svg", import.meta.url)
  .href;

export const gameItems = [
  {
    id: "neural-implant",
    nameEn: "Neural implant",
    nameUk: "Імплант",
    descriptionEn: "A neural interface that accelerates decisions and reaction time.",
    descriptionUk: "Нейроінтерфейс, що прискорює прийняття рішень і реакцію.",
    boardCopies: 5,
    deckCopies: 12,
    itemImage: new URL("./items/neural-implant.png", import.meta.url).href,
    cardImage: new URL("./cards/neural-implant-card.png", import.meta.url).href
  },
  {
    id: "screen-terminal",
    nameEn: "Screen terminal",
    nameUk: "Екран",
    descriptionEn: "A portable terminal for reading the city's hidden systems.",
    descriptionUk: "Портативний термінал для доступу до прихованих систем міста.",
    boardCopies: 5,
    deckCopies: 12,
    itemImage: new URL("./items/screen-terminal.png", import.meta.url).href,
    cardImage: new URL("./cards/screen-terminal-card.png", import.meta.url).href
  },
  {
    id: "memory-drive",
    nameEn: "Memory drive",
    nameUk: "Флешка пам'яті",
    descriptionEn: "A data drive containing stolen routes and access codes.",
    descriptionUk: "Накопичувач із викраденими маршрутами та кодами доступу.",
    boardCopies: 5,
    deckCopies: 12,
    itemImage: new URL("./items/memory-drive.png", import.meta.url).href,
    cardImage: new URL("./cards/memory-drive-card.png", import.meta.url).href
  },
  {
    id: "power-battery",
    nameEn: "Power battery",
    nameUk: "Акумулятор живлення",
    descriptionEn: "A compact power source for equipment on the escape route.",
    descriptionUk: "Компактне джерело живлення для спорядження на шляху втечі.",
    boardCopies: 5,
    deckCopies: 12,
    itemImage: new URL("./items/power-battery.png", import.meta.url).href,
    cardImage: new URL("./cards/power-battery-card.png", import.meta.url).href
  },
  {
    id: "whiskey-bottle",
    nameEn: "Whiskey bottle",
    nameUk: "Пляшка віскі",
    descriptionEn: "A rare city ration useful for barter and courage.",
    descriptionUk: "Рідкісний міський запас, корисний для обміну та хоробрості.",
    boardCopies: 5,
    deckCopies: 12,
    itemImage: new URL("./items/whiskey-bottle.png", import.meta.url).href,
    cardImage: new URL("./cards/whiskey-bottle-card.png", import.meta.url).href
  },
  {
    id: "crypto-card",
    nameEn: "Cryptocurrency access card",
    nameUk: "Криптокарта",
    descriptionEn: "An anonymous payment card accepted in the city's underground.",
    descriptionUk: "Анонімна платіжна картка, яку приймає міське підпілля.",
    boardCopies: 5,
    deckCopies: 12,
    itemImage: new URL("./items/crypto-card.png", import.meta.url).href,
    cardImage: new URL("./cards/crypto-card-card.png", import.meta.url).href
  },
  {
    id: "stun-pistol",
    nameEn: "Stun pistol",
    nameUk: "Електрошоковий пістолет",
    descriptionEn: "A non-lethal weapon for breaking through guarded sectors.",
    descriptionUk: "Нелетальна зброя для прориву крізь охоронювані сектори.",
    boardCopies: 5,
    deckCopies: 12,
    itemImage: new URL("./items/stun-pistol.png", import.meta.url).href,
    cardImage: new URL("./cards/stun-pistol-card.png", import.meta.url).href
  },
  {
    id: "tunnel-map",
    nameEn: "Hand-drawn tunnel map",
    nameUk: "Карта місцевості",
    descriptionEn: "A hand-drawn map marking safe passages through the tunnels.",
    descriptionUk: "Намальована від руки карта безпечних проходів тунелями.",
    boardCopies: 5,
    deckCopies: 12,
    itemImage: new URL("./items/tunnel-map.png", import.meta.url).href,
    cardImage: new URL("./cards/tunnel-map-card.png", import.meta.url).href
  },
  {
    id: "boost-shoes",
    nameEn: "Movement-boosting shoes",
    nameUk: "Взуття з прискорювачами",
    descriptionEn: "Powered shoes built for a fast escape across unstable ground.",
    descriptionUk: "Силове взуття для швидкої втечі нестабільною місцевістю.",
    boardCopies: 5,
    deckCopies: 12,
    itemImage: new URL("./items/boost-shoes.png", import.meta.url).href,
    cardImage: new URL("./cards/boost-shoes-card.png", import.meta.url).href
  }
];
