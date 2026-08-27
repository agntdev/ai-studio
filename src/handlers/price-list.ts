import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { adminChatId, inlineButton, inlineKeyboard, isOwner, registerMainMenuItem } from "../toolkit/index.js";
import { prices, savePrices, type Prices } from "../lead-data.js";

type PriceSession = { priceEdit?: keyof Prices };
registerMainMenuItem({ label: "💰 Прайс", data: "price_list", order: 40 });
const composer = new Composer<Ctx>();
const buttons = (items: Array<[string, string]>) => inlineKeyboard(items.map(([text, data]) => [inlineButton(text, data)]));
const session = (ctx: Ctx) => ctx.session as PriceSession;

function text(value: Prices): string {
  return `AI‑фото — ${value.photo}\nAI‑видео — ${value.video}\nРеклама для брендов — ${value.advertising}\n\nФинальная стоимость зависит от задачи и объёма.`;
}

async function render(ctx: Ctx, edit = false): Promise<void> {
  const admin = adminChatId(ctx as never);
  const value = admin ? await prices(ctx, admin) : await prices(ctx, "public");
  const actions: Array<[string, string]> = edit
    ? [["AI‑фото", "price:edit:photo"], ["AI‑видео", "price:edit:video"], ["Реклама", "price:edit:advertising"], ["← В меню", "menu:main"]]
    : [["Оставить заявку", "lead:start"], ["← В меню", "menu:main"]];
  if (isOwner(ctx)) actions.splice(actions.length - 1, 0, ["Редактировать прайс", "price:edit"]);
  await ctx.editMessageText(text(value), { reply_markup: buttons(actions) });
}

composer.callbackQuery("price_list", async (ctx) => { await ctx.answerCallbackQuery(); try { await render(ctx); } catch { await ctx.reply("Не удалось открыть прайс. Попробуйте ещё раз."); } });
composer.callbackQuery("price:edit", async (ctx) => { await ctx.answerCallbackQuery(); if (!isOwner(ctx as never)) return ctx.reply(adminChatId(ctx as never) ? "Только владелец может менять прайс." : "Доступ владельца ещё не настроен."); await render(ctx, true); });
composer.callbackQuery(/^price:edit:(photo|video|advertising)$/, async (ctx) => { await ctx.answerCallbackQuery(); if (!isOwner(ctx)) return ctx.reply("Только владелец может менять прайс."); session(ctx).priceEdit = ctx.match[1] as keyof Prices; await ctx.reply("Отправьте новую цену одной строкой."); });
composer.on("message:text", async (ctx, next) => {
  const key = session(ctx).priceEdit;
  if (!key) return next();
  const admin = adminChatId(ctx as never);
  if (!admin || !isOwner(ctx as never)) { delete session(ctx).priceEdit; return ctx.reply("Доступ владельца ещё не настроен."); }
  const value = ctx.message.text.trim();
  if (!value) return ctx.reply("Отправьте цену текстом одной строкой.");
  try { const current = await prices(ctx, admin); current[key] = value; if (!(await savePrices(ctx, admin, current))) return ctx.reply("Не удалось сохранить цену. Попробуйте ещё раз."); delete session(ctx).priceEdit; await ctx.reply("Прайс обновлён."); } catch { await ctx.reply("Не удалось сохранить цену. Попробуйте ещё раз."); }
});

export default composer;
