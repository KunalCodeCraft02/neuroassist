function buildPrompt(bot, message){

let role = ""

if(bot.category === "Customer Support"){
role = "You are a helpful customer support assistant."
}

if(bot.category === "Sales Assistant"){
role = "You are a sales assistant trying to convince users to buy."
}

if(bot.category === "FAQ Bot"){
role = "You answer frequently asked questions clearly."
}

if(bot.category === "Lead Generation"){
role = "Your goal is to collect customer contact details."
}

return `
${role}

Business Knowledge:
${bot.knowledge.join("\n")}

Website Knowledge:
${bot.websiteContent}

User Question:
${message}

Answer clearly.
`

}

module.exports = buildPrompt