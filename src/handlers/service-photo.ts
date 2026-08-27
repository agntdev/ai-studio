import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";

registerMainMenuItem({ label: "📸 AI‑фото", data: "service:photo", order: 10 });
const composer = new Composer<Ctx>();

composer.callbackQuery("service:photo", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("AI‑фото для карточек товаров, кампаний и соцсетей. Соберём визуал под ваш бренд.", { reply_markup: inlineKeyboard([[inlineButton("Оставить заявку", "lead:photo")], [inlineButton("← В меню", "menu:main")]]) });
});

export default composer;
