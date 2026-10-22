'use strict';
// Screenshots are an explicit diagnostic artifact, not a prerequisite for DOM assertions.
async function capture(page,options){if(process.env.QUIP_SCREENSHOTS==='1')return page.screenshot(options);}
module.exports={capture};
