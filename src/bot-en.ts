import TelegramBot, { SendMessageOptions } from "node-telegram-bot-api";
import * as dotenv from "dotenv";
import axios from "axios";
import moment from "moment";
import { clear } from "console";
interface ScoringPeriodData {
  balance: number;
}

dotenv.config();

const tgApiKey = process.env.TG_API_KEY_EN || "";
const bot = new TelegramBot(tgApiKey, { polling: true });
const options: SendMessageOptions = {
  parse_mode: "Markdown",
  disable_web_page_preview: true,
};

const chats: Set<number> = new Set();
let intervalRef: NodeJS.Timeout | undefined;
const messageDeletionTimeout = 60000;

moment.locale("ru");

const loadBalance = async () => {
  const url = "https://status.joystream.org/cashout/balance";
  const { data } = await axios.get(url);
  return data;
};

bot.on("message", async (msg: TelegramBot.Message) => {
  if (msg && msg.from) {
    console.log(msg.chat);
    const chatId = msg.chat.id;
    const username = `${msg.from.first_name} ${
      msg.from.last_name || ""
    }`.trim();

    const userParsed = `[${username}](tg://user?id=${msg.from.id})`;

    if (msg.text?.startsWith("/balance") || msg.text?.startsWith("/start")) {
      const { balance } = await loadBalance();
      const status = `${
        balance < 1
          ? "Денег нет, но вы держитесь!"
          : "Налетай, торопись, покупай живопИсь!"
      } `;
      const messageContent = `Привет, ${userParsed}. Баланс: ${balance} BCH. ${status}`;
      sendMessage(chatId, messageContent, msg);
    } else if (msg.text?.startsWith("/notify")) {
      invalidateBalanceCheck();
      chats.add(chatId);
      scheduleBalanceCheck();
      const messageContent = `Уведомления о положительном балансе включены, ${userParsed}.`;
      sendMessage(chatId, messageContent, msg);
    } else if (msg.text?.startsWith("/notifyoff")) {
      invalidateBalanceCheck();
      chats.delete(chatId);
      scheduleBalanceCheck();
      const messageContent = `Уведомления о положительном балансе отключены, ${userParsed}.`;
      sendMessage(chatId, messageContent, msg);
    }
  }
});

function sendMessage(
  chatId: number,
  messageContent: string,
  msg: TelegramBot.Message | undefined
) {
  bot.sendMessage(chatId, messageContent, options).then((message) => {
    try {
      if (msg) {
        bot.deleteMessage(chatId, msg.message_id.toString());
      }
    } catch (e) {}
    setTimeout(() => {
      try {
        bot.deleteMessage(chatId, message.message_id.toString());
      } catch (e) {}
    }, messageDeletionTimeout);
  });
}

function invalidateBalanceCheck() {
  if (intervalRef) {
    clearInterval(intervalRef);
  }
}

async function scheduleBalanceCheck() {
  intervalRef = setTimeout(async () => {
    try {
      const { balance } = await loadBalance();
      chats.forEach(async (chatId) => {
        const status = `${
          balance < 1
            ? "Денег нет, но вы держитесь!"
            : "Налетай, торопись, покупай живопИсь!"
        } `;
        if (balance > 1) {
          const messageContent = `Баланс: ${balance} BCH. ${status}`;
          sendMessage(chatId, messageContent, undefined);
        }
      });
    } catch (e) {}
  }, messageDeletionTimeout);
}
