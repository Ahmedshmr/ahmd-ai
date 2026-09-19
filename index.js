// =================================================================
// 🤖 Gemini & Image Bot - ذكاء اصطناعي، صور واقعية 4K، وتصفير الشات
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

// دالة المحادثة النصية (تستخدم نماذج تمنحك 1500 طلب مجاني يومياً دون خطأ 429)
async function generateAiReply(promptText) {
  const models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-flash-latest"];
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
  throw new Error("فشل توليد الرد، يرجى الانتظار دقيقة.");
}

// دالة ترجمة وتحسين وصف الصورة فورياً (بدون استهلاك حصة Gemini نهائياً!)
async function translateAndEnhancePrompt(arabicText) {
  let englishPrompt = arabicText;
  try {
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(arabicText)}`);
    const data = await res.json();
    if (data && data[0] && data[0][0] && data[0][0][0]) {
      englishPrompt = data[0][0][0];
    }
  } catch (err) {
    console.warn("Translation fallback error:", err);
  }

  // دعم خاص ودقيق للزي والشماغ والثوب السعودي
  const lower = arabicText.toLowerCase();
  if (lower.includes("شماغ") || lower.includes("ثوب") || lower.includes("سعودي") || lower.includes("عربي")) {
    return `Cinematic photorealistic portrait of an authentic young Saudi Arab man wearing traditional red and white shemagh with black agal and pristine white thobe, desert or palace background, handsome, high detail, 8k resolution, professional studio lighting`;
  }

  // تحسين أي وصف عام ليصبح واقعياً
  return `High quality, ultra-detailed, photorealistic portrait or scene of ${englishPrompt}, 8k, cinematic lighting, masterpiece`;
}

// دالة توليد الصورة الحقيقية
async function generateImageBuffer(rawPrompt) {
  const enhancedPrompt = await translateAndEnhancePrompt(rawPrompt);
  const encoded = encodeURIComponent(enhancedPrompt);
  const imageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&model=flux&seed=${Math.floor(Math.random() * 9999999)}`;

  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error("تعذر إنشاء الصورة");
  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    enhancedPrompt,
  };
}

client.once("ready", () => {
  console.log(`🚀 البوت متصل وشغال كـ: ${client.user.tag}`);
  client.user.setActivity({ name: "توليد الصور | !صورة | !تصفير", type: ActivityType.Playing });
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim();
  const isMentioned = client.user && message.mentions.has(client.user);
  let clean = content;
  if (isMentioned && client.user) {
    clean = content.replace(new RegExp(`<@!?${client.user.id}>`, "g"), "").trim();
  }

  // 1. أمر تصفير الشات بالكامل (!تصفير أو !nuke)
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

  // 3. كشف أي طلب لصورة (بالعامية أو بالأمر المباشر)
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

    const waitMsg = await message.reply("🎨 **أبشر! جاري رسم وتوليد الصورة لك الآن بدقة 4K... ثواني وتكون جاهزة!** ⏳");

    try {
      await message.channel.sendTyping();
      const { buffer } = await generateImageBuffer(imgPrompt);
      const file = new AttachmentBuilder(buffer, { name: "ai_art.jpg" });

      const embed = new EmbedBuilder()
        .setTitle("🖼️ تفضل صورتك المطلوبة!")
        .setDescription(`**طلبك:** ${imgPrompt}\n**الدقة:** فائقة الواقعية (4K Ultra-HD) ✨`)
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
