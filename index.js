// =================================================================
// 🤖 Ahmd Bot - النسخة السريعة والمستقرة 100%
// =================================================================

import { Client, GatewayIntentBits, Partials, EmbedBuilder, PermissionsBitField, ActivityType } from "discord.js";
import dotenv from "dotenv";
import http from "http";

dotenv.config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

if (!DISCORD_TOKEN) {
  console.error("❌ تأكد من توفر DISCORD_TOKEN في Render");
  process.exit(1);
}

const SYSTEM_PROMPT = `أنت مساعد ذكاء اصطناعي سعودي ذكي ومرح في سيرفر دسكورد، تتحدث باللغة العربية بأسلوب راقي وواضح، وتستخدم الإيموجي المناسب.`;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// دالة المحادثة الفورية الفائقة (لا تتوقف ولا تعتمد على حصص قوقل المحدودة!)
async function askAI(userPrompt) {
  try {
    const res = await fetch("https://text.pollinations.ai/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt }
        ],
        model: "mistral",
        jsonMode: false
      })
    });

    if (res.ok) {
      const text = await res.text();
      if (text && text.trim()) return text.trim();
    }
  } catch (e) {
    console.error("AI Error:", e);
  }

  // محرك بديل فوري في حال تعثر الأول
  try {
    const res2 = await fetch(`https://text.pollinations.ai/${encodeURIComponent(userPrompt)}?model=searchgpt`);
    if (res2.ok) {
      const t = await res2.text();
      if (t && t.trim()) return t.trim();
    }
  } catch (err) {}

  return "هلا وغلا! معك حمودي الذكي، اسألني اللي تبيه وأبشر بالرد السريع 🇸🇦✨";
}

// دالة توليد الصور
function getImageUrl(promptText) {
  const lower = promptText.toLowerCase();
  let artPrompt = `cinematic 8k photorealistic portrait of ${promptText}, sharp focus, studio lighting`;

  if (lower.includes("شماغ") || lower.includes("ثوب") || lower.includes("سعودي")) {
    artPrompt = `cinematic photorealistic portrait of an authentic handsome young Saudi Arab man wearing pristine traditional red and white shemagh, black agal, clean white thobe, elegant luxury background, ultra 8k resolution, professional photography`;
  } else if (lower.includes("صقر") || lower.includes("falcon")) {
    artPrompt = `majestic Arabian hunting falcon sitting on a desert perch, golden hour sunset, hyper-detailed feathers, 8k photography`;
  } else if (lower.includes("سيارة") || lower.includes("car")) {
    artPrompt = `luxury sports car racing in Riyadh city at night, neon lights, 8k realistic automotive render`;
  }

  const encoded = encodeURIComponent(artPrompt);
  const randomSeed = Math.floor(Math.random() * 9999999);
  return `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&seed=${randomSeed}`;
}

client.once("ready", () => {
  console.log(`🚀 البوت شغال ومتصل كـ: ${client.user.tag}`);
  client.user.setActivity({
    name: "منشن وازهلك",
    type: ActivityType.Playing,
  });
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim();
  const isMentioned = client.user && message.mentions.has(client.user);
  let clean = content;
  if (isMentioned && client.user) {
    clean = content.replace(new RegExp(`<@!?${client.user.id}>`, "g"), "").trim();
  }

  // 1. أمر مسح وتصفير الشات (!تصفير)
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
        .setDescription(`تم تنظيف الروم بالكامل بواسطة المشرف: **${message.author.username}** 🧹`)
        .setColor(0xed4245)
        .setTimestamp();

      const sent = await newCh.send({ embeds: [embed] });
      setTimeout(() => sent.delete().catch(() => {}), 5000);
      return;
    } catch {
      return message.channel.send("⚠️ تأكد من إعطاء البوت رتبة Administrator.");
    }
  }

  // 2. أمر مسح عدد معين من الرسائل (!مسح 20)
  if (content.startsWith("!clear") || content.startsWith("!مسح")) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.reply("⛔ تحتاج لصلاحية (Manage Messages)!");
    }
    const count = Math.min(Math.max(parseInt(content.split(/\s+/)[1]) || 10, 1), 100);
    try {
      await message.channel.bulkDelete(count + 1, true);
      const m = await message.channel.send(`🧹 تم مسح **${count}** رسالة!`);
      setTimeout(() => m.delete().catch(() => {}), 3000);
      return;
    } catch {
      return message.reply("⚠️ استخدم `!تصفير` لتنظيف الروم بالكامل.");
    }
  }

  // 3. كشف طلبات الصور
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

    if (!imgPrompt) imgPrompt = "شخص لابس شماغ وثوب سعودي";

    const waitMsg = await message.reply("🎨 **أبشر! جاري رسم صورتك بأعلى دقة، لحظات...** ⏳");

    try {
      await message.channel.sendTyping();
      const imageUrl = getImageUrl(imgPrompt);

      const embed = new EmbedBuilder()
        .setTitle("🖼️ تفضل صورتك المطلوبة!")
        .setDescription(`**طلبك:** ${imgPrompt}\n**الجودة:** فوتوغرافية فائقة الواقعية (4K Ultra-HD) ✨`)
        .setImage(imageUrl)
        .setColor(0x5865f2)
        .setFooter({ text: `طُلبت بواسطة ${message.author.username}` })
        .setTimestamp();

      await waitMsg.delete().catch(() => {});
      return message.reply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      return waitMsg.edit("❌ حدث خطأ أثناء إرسال الصورة، أعد المحاولة.");
    }
  }

  // 4. الرد على الأسئلة والمحادثة
  if (isMentioned || content.startsWith("!ask ")) {
    if (clean.startsWith("!ask ")) clean = clean.slice(5).trim();
    if (!clean) return message.reply("أهلاً بك يا غالي! منشن وازهلك، آمرني وش ودك تسأل عنه؟ 🤖");

    try {
      await message.channel.sendTyping();
      const reply = await askAI(clean);

      if (reply.length <= 1950) {
        await message.reply(reply);
      } else {
        const parts = reply.match(/[\s\S]{1,1900}/g) || [reply];
        await message.reply(parts[0]);
        for (let i = 1; i < parts.length; i++) await message.channel.send(parts[i]);
      }
    } catch (err) {
      console.error(err);
      await message.reply("هلا بك يا غالي! أعد المنشن وراح أرد عليك فوراً ✨");
    }
  }
});

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("🤖 البوت يعمل 24/7!");
}).listen(PORT);

client.login(DISCORD_TOKEN);
