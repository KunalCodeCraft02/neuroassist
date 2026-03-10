const axios = require("axios")
const cheerio = require("cheerio")

async function scrapeWebsite(url){

try{

const {data} = await axios.get(url)

const $ = cheerio.load(data)

let text = ""

$("h1,h2,h3,p,li").each((i,el)=>{
text += $(el).text() + " "
})

return text

}catch(err){

console.log("SCRAPER ERROR:",err)

return ""

}

}

module.exports = scrapeWebsite