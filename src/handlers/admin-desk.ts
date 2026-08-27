import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { adminChatId, inlineButton, inlineKeyboard, registerMainMenuItem, requireOwner } from "../toolkit/index.js";
import { application, applications, saveApplication, type Application, type LeadStatus } from "../lead-data.js";
import { now } from "../time.js";

registerMainMenuItem({ label: "🗂️ Заявки", data: "desk:open", order: 70 });
const composer = new Composer<Ctx>();
const statusLabel: Record<LeadStatus, string> = { new: "новая", processing: "в работе", completed: "готово" };
const buttons = (items: Array<[string, string]>) => inlineKeyboard(items.map(([text, data]) => [inlineButton(text, data)]));

async function owner(ctx: Ctx): Promise<string | undefined> {
  if (!(await requireOwner(ctx as never))) return undefined;
  const id = adminChatId(ctx as never);
  if (!id) return undefined;
  return id;
}

async function showList(ctx: Ctx, admin: string): Promise<void> {
  const list = await applications(ctx, admin);
  if (!list.length) { await ctx.editMessageText("Заявок пока нет — новые обращения появятся здесь.", { reply_markup: buttons([["← В меню", "menu:main"]]) }); return; }
  await ctx.editMessageText("Выберите заявку, чтобы посмотреть детали и сменить статус.", { reply_markup: buttons([...list.slice(-8).reverse().map((item) => [`${item.serviceType} · ${statusLabel[item.status]}`, `app:view:${item.id}`] as [string, string]), ["← В меню", "menu:main"]]) });
}

function detailText(item: Application): string {
  const history = item.history.map((entry) => statusLabel[entry.status]).join(" → ");
  return `Заявка: ${item.serviceType}\nЗадача: ${item.taskDescription}\nКонтакт: ${item.contactInfo}\nМатериалы: ${item.materials.length ? item.materials.length : "нет"}\nСтатус: ${statusLabel[item.status]}\nИстория: ${history}`;
}

async function showApplication(ctx: Ctx, admin: string, id: string): Promise<void> {
  const item = await application(ctx, admin, id);
  if (!item) { await ctx.editMessageText("Эта заявка уже недоступна.", { reply_markup: buttons([["К заявкам", "desk:open"]]) }); return; }
  await ctx.editMessageText(detailText(item), { reply_markup: buttons([["Новая", `app:status:${id}:new`], ["В работе", `app:status:${id}:processing`], ["Готово", `app:status:${id}:completed`], ["К заявкам", "desk:open"]]) });
}

composer.callbackQuery("desk:open", async (ctx) => { const admin = await owner(ctx); if (!admin) return; await ctx.answerCallbackQuery(); try { await showList(ctx, admin); } catch { await ctx.reply("Не удалось загрузить заявки. Попробуйте ещё раз."); } });
composer.callbackQuery(/^app:view:([\w-]+)$/, async (ctx) => { const admin = await owner(ctx); if (!admin) return; await ctx.answerCallbackQuery(); await showApplication(ctx, admin, ctx.match[1]); });
composer.callbackQuery(/^app:status:([\w-]+):(new|processing|completed)$/, async (ctx) => { const admin = await owner(ctx); if (!admin) return; await ctx.answerCallbackQuery(); const item = await application(ctx, admin, ctx.match[1]); if (!item) return ctx.reply("Эта заявка уже недоступна."); const status = ctx.match[2] as LeadStatus; if (item.status !== status) { item.status = status; item.history.push({ status, at: now() }); await saveApplication(ctx, admin, item); } await showApplication(ctx, admin, item.id); });

export default composer;
