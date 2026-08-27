import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";

registerMainMenuItem({ label: "🎬 AI‑видео", data: "service:video", order: 20 });
const composer = new Composer<Ctx>();

composer.callbackQuery("service:video", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("AI‑видео для запусков, рекламы и ленты. От идеи до динамичного ролика — в одном процессе.", { reply_markup: inlineKeyboard([[inlineButton("Оставить заявку", "lead:video")], [inlineButton("← В меню", "menu:main")]]) });
});

export default composer;
