
].map(([id,difficulty,question,answer,unit,categories,note,source,pack='approx-core-v1'])=>Object.freeze({
 id:'approx-'+id,question,answer,unit,difficulty,categories:Object.freeze(categories.split(',')),note,
 source:QUIP_APPROX_SOURCES[source]||source,pack
})));
function getApproxQuestionPool(level){
 if(!PARTY_CARD_LEVELS.includes(level))throw Error('Unknown question difficulty');
 return QUIP_APPROX_QUESTIONS.filter(question=>question.difficulty===level);
}
function settleSharedAward(round,choice){
 const recipients={a:[0],b:[1],both:[0,1],none:[]}[choice];
 if(!recipients)throw Error('Unknown shared award');
 return {recipients:recipients.slice(),deltas:[0,1].map(index=>recipients.includes(index)?round.points:0)};
}
