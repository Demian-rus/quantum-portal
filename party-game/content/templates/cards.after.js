
].map(card=>Object.freeze({...card,
  categories:Object.freeze(card.categories),
  ...(card.meta?{meta:Object.freeze(card.meta)}:{})
})));
const PARTY_CARD_BY_ID=new Map(PARTY_CARDS.map(card=>[card.id,card]));
const PARTY_CARD_POOLS=Object.freeze(Object.fromEntries(PARTY_CARD_TYPES.map(type=>[
  type,Object.freeze(Object.fromEntries(PARTY_CARD_LEVELS.map(level=>[
    level,Object.freeze(PARTY_CARDS.filter(card=>card.type===type&&card.difficulty===level))
  ])))
])));
function getCardById(id){return PARTY_CARD_BY_ID.get(id)||null;}
function getCardPool(kind,level,promptTypes){
  const tier=PARTY_CARD_LEVELS.includes(level)?level:'easy';
  if(kind==='songs')return PARTY_CARD_POOLS.song[tier];
  if(kind==='people')return PARTY_CARD_POOLS.person[tier];
  if(kind==='blitz')return PARTY_CARD_POOLS.word.easy.filter(card=>card.text.length<=12);
  const selected=Array.isArray(promptTypes)&&promptTypes.length?promptTypes:['word','phrase','idiom'];
  return selected.flatMap(type=>PARTY_CARD_POOLS[type]?.[tier]||[]);
}
