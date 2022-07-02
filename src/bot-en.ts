import TelegramBot, { SendMessageOptions } from "node-telegram-bot-api";
import * as dotenv from "dotenv";
import axios from "axios";
import moment from "moment";
import e from "cors";
import { start } from "repl";
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

const messageDeletionTimeout = 60000;
const chats: Set<number> = new Set();
let intervalRef: NodeJS.Timeout | undefined;
let lastKnownBalance = 0;

// moment.locale("ru");

const loadBalance = async () => {
  const url = "https://status.joystream.org/cashout/balance";
  const { data } = await axios.get(url);
  return data;
};

const loadExchanges = async () => {
  const url = "https://status.joystream.org/status";
  const { data } = await axios.get(url);
  return data.exchanges as Array<Exchange>;
};

interface Exchange {
  sender: string;
  amount: number;
  amountUSD: number;
  logTime: string;
  status: string;
}

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
      const messageContent = `Привет, ${userParsed}\nБаланс: ${balance} BCH.\n${status}`;
      sendMessage(chatId, messageContent, msg);
    } else if (msg.text?.startsWith("/notifyoff")) {
      invalidateBalanceCheck();
      chats.delete(chatId);
      scheduleBalanceCheck();
      const messageContent = `Уведомления о положительном балансе отключены, ${userParsed}.`;
      sendMessage(chatId, messageContent, msg);
    } else if (msg.text?.startsWith("/notify")) {
      invalidateBalanceCheck();
      chats.add(chatId);
      scheduleBalanceCheck();
      const messageContent = `Уведомления о положительном балансе включены, ${userParsed}.`;
      sendMessage(chatId, messageContent, msg);
    } else if (msg.text?.startsWith("/react")) {
      const messageContent = `Ебать у вас тут весело!`;
      sendMessage(chatId, messageContent, msg, false);
    } else if (msg.text?.startsWith("/cash")) {
      const exchanges = await loadExchanges();

      let myExchanges;

      const msgArr = msg.text.split(" ");
      if (msgArr.length > 1) {
        myExchanges = exchanges
          .filter((e) => e.sender === msgArr[1])
          .sort((a, b) => (a.status > b.status ? -1 : 1));
      } else {
        const acc1 = "5CiRcZCWKDDo4nu1TNXnRVYWichHHmyU6x1nCUeDwjCNQRCw";
        const acc2 = "5EiqT7y3DhzV4Sxuu2up2cAV6tow1nqUn1ntMAAJ3ynfMhHB";
        myExchanges = exchanges
          .filter((e) => e.sender === acc1 || e.sender === acc2)
          .sort((a, b) => (a.status > b.status ? -1 : 1));
      }

      let messageContent = `My exchanges:\n`;
      let totalAmount = 0;
      let totalLeft = 0;
      let totalPaid = 0;

      for (let i = 0; i < myExchanges.length; i++) {
        const e = myExchanges[i];
        totalAmount += e.amountUSD;

        const date = moment.parseZone(e.logTime).format("dddd DD MMM HH:mm");
        if (e.status === "FINALIZED") {
          totalPaid += e.amountUSD;
        } else {
          totalLeft += e.amountUSD;
        }
        let msg = `*Amount tJOY*: \`${e.amount}\`\n*Amount USD*: \`${e.amountUSD}\`\n*Sender*: \`${e.sender}\`\n*Date*: \`${date}\`\n*Status*: \`${e.status}\`\n\n`;
        messageContent += msg;
      }

      messageContent = `*Total USD: ${totalAmount}*\n\n*Total Paid: ${totalPaid}*\n\n*Total Left: ${totalLeft}*\n\n${messageContent}\n\n`;

      sendMessage(chatId, messageContent, msg, false);
    }
  }
});

function sendMessage(
  chatId: number,
  messageContent: string,
  msg: TelegramBot.Message | undefined,
  shouldDelete: Boolean = true
) {
  bot.sendMessage(chatId, messageContent, options).then((message) => {
    try {
      if (msg) {
        bot.deleteMessage(chatId, msg.message_id.toString());
      }
    } catch (e) {}
    setTimeout(() => {
      try {
        if (shouldDelete) {
          bot.deleteMessage(chatId, message.message_id.toString());
        }
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
  console.log(`Scheduling task for chat's [${Array.from(chats.values())}]`);
  intervalRef = setInterval(async () => {
    try {
      const { balance } = await loadBalance();
      chats.forEach(async (chatId) => {
        const status = `${
          balance < 1
            ? "Денег нет, но вы держитесь!"
            : "Налетай, торопись, покупай живопИсь!"
        } `;
        if (balance !== lastKnownBalance) {
          const messageContent = `Баланс: ${balance} BCH. ${status}`;
          sendMessage(chatId, messageContent, undefined);
          lastKnownBalance = balance;
        }
      });
    } catch (e) {}
  }, messageDeletionTimeout);
}
