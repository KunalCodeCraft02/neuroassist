require("dotenv").config();

const Groq = require("groq-sdk");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

/* =========================
   CATEGORY ROLE MAP
========================= */

function getRole(category) {

    const roles = {

        "customer-support":
            "You are a helpful customer support assistant. Solve customer problems politely and clearly.",

        "sales":
            "You are a professional sales assistant. Recommend products and encourage users to make a purchase.",

        "faq":
            "You answer frequently asked questions clearly and concisely.",

        "lead-generation":
            "Your goal is to collect customer contact details like email or phone politely.",

        "ecommerce":
            "You help users find products, explain product details, and assist with orders and delivery.",

        "technical":
            "You are a technical support assistant. Help users fix software or technical issues step by step.",

        "booking":
            "You help users book appointments, reservations, or schedules.",

        "product-advisor":
            "Recommend the best products based on the user's needs and preferences.",

        "marketing":
            "Explain services, promotions, and pricing plans to users clearly.",

        "hr":
            "Answer questions related to recruitment, hiring, and employee policies.",

        "education":
            "Help students with course information, admissions, and study guidance.",

        "healthcare":
            "Provide general healthcare information but avoid giving dangerous medical advice.",

        "general":
            "You are a helpful AI assistant.",

        "custom":
            "You are a customizable AI assistant."
    };

    return roles[category] ||
        "You are a helpful AI assistant.";
}

/* =========================
   GENERATE AI REPLY
========================= */

async function generateReply(bot, message) {

    try {

        // Validate API key
        if (!process.env.GROQ_API_KEY) {

            console.log("❌ GROQ API KEY MISSING");

            return "AI service configuration error.";
        }

        // Validate message
        if (!message || typeof message !== "string") {

            return "Invalid message.";
        }

        // Role
        const role =
            getRole(bot.category);

        // Knowledge
        let knowledge = "";

        if (
            bot.knowledge &&
            Array.isArray(bot.knowledge)
        ) {

            knowledge =
                bot.knowledge.join("\n");
        }

        // Website content
        const websiteData =
            bot.websiteContent || "";

        // Limit huge content
        const limitedWebsiteData =
            websiteData.substring(0, 12000);

        const limitedKnowledge =
            knowledge.substring(0, 8000);

        /* =========================
           FINAL PROMPT
        ========================= */

        const prompt = `

${role}

Use the following business knowledge if relevant.

BUSINESS KNOWLEDGE:
${limitedKnowledge}

WEBSITE KNOWLEDGE:
${limitedWebsiteData}

USER QUESTION:
${message}

RULES:
- Answer professionally
- Be helpful and friendly
- Keep answers short and clear
- Use business knowledge when useful
- Do not hallucinate fake information
`;

        console.log("🤖 GENERATING AI REPLY...");

        const chat =
            await groq.chat.completions.create({

                messages: [

                    {
                        role: "user",
                        content: prompt
                    }

                ],

                model: "llama-3.1-8b-instant",

                temperature: 0.7,

                max_tokens: 500
            });

        // Validate response
        if (
            !chat ||
            !chat.choices ||
            !chat.choices[0]
        ) {

            console.log("❌ INVALID GROQ RESPONSE");

            return "AI could not generate a response.";
        }

        const reply =
            chat.choices[0].message.content;

        console.log("✅ AI REPLY GENERATED");

        return reply ||
            "AI could not generate a response.";

    } catch (err) {

        console.log("🔥 GROQ ERROR:");
        console.log(err);

        return "AI service temporarily unavailable.";
    }
}

module.exports = generateReply;