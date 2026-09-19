// =================================================================
// 🤖 Gemini & Image Bot - ذكاء اصطناعي، رسم وتوليد صور، وتصفير
// =================================================================

import { Client, GatewayIntentBits, Partials, EmbedBuilder, AttachmentBuilder, PermissionsBitField, ActivityType } from "discord.js";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import http from "http";

dotenv.config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!DISCORD_TOKEN || !GEMINI_API_KEY) {
  console.error("❌ تأكد من توفر المفاتيح في Render");
  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
  httpOptions: { headers: { "User-Agent": "aistudio-build" } },
});

const SYSTEM_PROMPT = `أنت مساعد ذكاء اصطناعي ذكي ومرح في سيرفر دسكورد، تتحدث باللغة العربية بطلاقة وبأسلوب ودود وجميل.`;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// دالة المحادثة النصية
async function generateAiReply(promptText) {
  const models = ["gemini-flash-latest", "gemini-3.8-flash", "gemini-3.1-flash-lite"];
  for (const m of models) {
    try {
      const res = await ai.models.generateContent({
        model: m,
        contents: promptText,
        config: { systemInstruction: SYSTEM_PROMPT },
      });
      if (res?.text) return res.text;
    } catch (e) {}
  }
  throw new Error("فشل توليد الرد.");
}

// دالة تحسين الوصف وتوليد الصورة بدقة 4K عبر محرك FLUX السريع
async function generateImageBuffer(rawPrompt) {
  let englishPrompt = rawPrompt;
  try {
    // نطلب من Gemini ترجمة وتحسين الوصف الفني للرسم بالإنجليزية
    const transRes = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: `Translate and enhance this image description into a high-quality descriptive English art prompt (maximum 40 words, output ONLY the prompt text without quotes or explanations): "${rawPrompt}"`,
    });
    if (transRes?.text) {
      englishPrompt = transRes.text.trim().replace(/^["']|["']$/g, "");
    }
  } catch (e) {
    console.warn("Could not enhance prompt, using raw prompt:", e?.message);
  }

  // توليد الصورة عبر محرك رسم عالي الدقة (Flux)
  const encoded = encodeURIComponent(englishPrompt);
  const imageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&model=flux&seed=${Math.floor(Math.random() * 999999)}`;

  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error("تعذر تحميل الصورة");
  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    enhancedPrompt: englishPrompt,
  };
}

client.once("ready", () => {
  console.log(`🚀 البوت متصل وشغال كـ: ${client.user.tag}`);
  client.user.setActivity({ name: "توليد الصور والرسم | !صورة | !تصفير", type: ActivityType.Playing });
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim();
  const isMentioned = client.user && message.mentions.has(client.user);
  let clean = content;
  if (isMentioned && client.user) {
    clean = content.replace(new RegExp(`<@!?${client.user.id}>`, "g"), "").trim();
  }

  // 1. أمر مسح وتصفير الروم بالكامل (!تصفير أو !nuke)
  if (content === "!تصفير" || content === "!nuke" || content === "!مسح الكل" || clean === "تصفير") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels) && 
        !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("⛔ هذا الأمر للمشرفين فقط (صلاحية Manage Channels)!");
    }
    try {
      const ch = message.channel;
      const pos = ch.position;
      const newCh = await ch.clone();
      await ch.delete();
      await newCh.setPosition(pos);

      const embed = new EmbedBuilder()
        .setTitle("💥 تم تصفير الشات ومسح كل الرسائل!")
        .setDescription(`تم تنظيف الروم بالكامل بواسطة: **${message.author.username}** 🧹`)
        .setColor(0xed4245)
        .setTimestamp();

      const sent = await newCh.send({ embeds: [embed] });
      setTimeout(() => sent.delete().catch(() => {}), 6000);
      return;
    } catch {
      return message.channel.send("⚠️ تأكد من إعطاء البوت رتبة عليا مع صلاحية Administrator!");
    }
  }

  // 2. أمر مسح عدد رسائل محدد (!مسح 20)
  if (content.startsWith("!clear") || content.startsWith("!مسح")) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.reply("⛔ تحتاج لصلاحية (Manage Messages)!");
    }
    const count = Math.min(Math.max(parseInt(content.split(/\s+/)[1]) || 10, 1), 100);
    try {
      await message.channel.bulkDelete(count + 1, true);
      const m = await message.channel.send(`🧹 تم مسح **${count}** رسالة!`);
      setTimeout(() => m.delete().catch(() => {}), 3500);
      return;
    } catch {
      return message.reply("⚠️ استخدم `!تصفير` لتنظيف الروم بالكامل.");
    }
  }

  // 3. كشف أي طلب لصورة (سواء بأمر !صورة أو بأي كلام بالعامية)
  const lower = clean.toLowerCase();
  const isImageRequest = 
    content.startsWith("!صورة ") || content.startsWith("!image ") ||
    (isMentioned && (
      lower.includes("صوره") || lower.includes("صورة") || 
      lower.includes("ارسم") || lower.includes("رسم") || 
      lower.includes("شماغ") || lower.includes("تصميم")
    ));

  if (isImageRequest) {
    let imgPrompt = clean
      .replace(/^(!صورة|!image)\s*/i, "")
      .replace(/^(ابيك|ابي|ودي|ممكن|تكفى|بالله|لو سمحت)?\s*(تسوي|تصمم|ترسم|تولد|تعمل|تسويلي|تصمملي)?\s*(لي)?\s*(صوره|صورة)?\s*(لـ|عن|حق|توضح)?\s*/i, "")
      .trim();

    if (!imgPrompt || imgPrompt.length < 2) imgPrompt = clean;

    const waitMsg = await message.reply("🎨 **أبشر! جاري رسم وتوليد الصورة لك الآن بأعلى دقة... ثواني وتجهز!** ⏳");

    try {
      await message.channel.sendTyping();
      const { buffer, enhancedPrompt } = await generateImageBuffer(imgPrompt);
      const file = new AttachmentBuilder(buffer, { name: "ai_art.jpg" });

      const embed = new EmbedBuilder()
        .setTitle("🖼️ تفضل صورتك المطلوبة!")
        .setDescription(`**طلبك:** ${imgPrompt}\n**النمط:** عالية الدقة (Ultra-Realistic)`)
        .setImage("attachment://ai_art.jpg")
        .setColor(0x5865f2)
        .setFooter({ text: `طُلبت بواسطة ${message.author.username}` })
        .setTimestamp();

      await waitMsg.delete().catch(() => {});
      return message.reply({ embeds: [embed], files: [file] });
    } catch (err) {
      console.error(err);
      return waitMsg.edit("❌ حدث خطأ أثناء إنشاء الصورة، يرجى إعادة المحاولة.");
    }
  }

  // 4. الرد على المحادثات والأسئلة العامة
  if (isMentioned || content.startsWith("!ask ")) {
    if (clean.startsWith("!ask ")) clean = clean.slice(5).trim();
    if (!clean) return message.reply("أهلاً بك! اسألني أي سؤال أو اطلب صورة بالمنشن أو بالأمر: `!صورة [الوصف]` 🎨");

    try {
      await message.channel.sendTyping();
      const reply = await generateAiReply(clean);
      if (reply.length <= 1950) {
        await message.reply(reply);
      } else {
        const parts = reply.match(/[\s\S]{1,1900}/g) || [reply];
        await message.reply(parts[0]);
        for (let i = 1; i < parts.length; i++) await message.channel.send(parts[i]);
      }
    } catch (e) {
      await message.reply("⚠️ واجهت مشكلة في التفكير، حاول لاحقاً.");
    }
  }
});

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("🤖 البوت يعمل بنجاح!");
}).listen(PORT);

client.login(DISCORD_TOKEN);
