import TelegramBot, { SendMessageOptions } from "node-telegram-bot-api";
import * as dotenv from "dotenv";
import axios from "axios";
import moment from "moment";

dotenv.config();

const PORT = process.env.PORT ? +process.env.PORT : 3000;
const tgApiKey = process.env.TG_API_KEY || "";
const bot = new TelegramBot(tgApiKey, { polling: true });
moment.locale("ru");

const loadScoringPeriodData = async () => {
  const url =
    "https://raw.githubusercontent.com/Joystream/founding-members/main/data/fm-info.json";
  const { data } = await axios.get(url);
  return data.scoringPeriodsFull;
};

interface ScoringPeriodData {
  currentScoringPeriod: {
    scoringPeriodId: number;
    started: string;
    ends: string;
    referralCode: number;
  };
  lastPeriod: {
    scoringPeriodId: number;
    started: string;
    ends: string;
    referralCode: number;
    totalDirectScore: number;
    totalReferralScore: number;
    highlights: string[];
  };
}

let nextSyncDate = moment();
let scoringData = {} as ScoringPeriodData;

bot.on("message", async (msg: TelegramBot.Message) => {
  if (nextSyncDate.isBefore(moment())) {
    scoringData = await loadScoringPeriodData();
    nextSyncDate = moment.parseZone(scoringData.currentScoringPeriod.ends);
  }
  if (msg && msg.from) {
    console.log(msg.chat);
    const chatId = msg.chat.id;
    const username = `${msg.from.first_name} ${
      msg.from.last_name || ""
    }`.trim();

    const userParsed = `[${username}](tg://user?id=${msg.from.id})`;
    const options: SendMessageOptions = { parse_mode: "Markdown" };

    if (msg.text?.startsWith("/scoring")) {
      const endDate = moment.parseZone(scoringData.currentScoringPeriod.ends);
      const duration = moment.duration(endDate.diff(moment()));
      const daysDuration = duration.asDays().toFixed();
      let dayText = "дней";
      if (daysDuration === "1") {
        dayText = "день";
      } else if (
        daysDuration === "2" ||
        daysDuration === "3" ||
        daysDuration === "4"
      ) {
        dayText = "дня";
      }
      const daysLeft = `***${duration
        .asDays()
        .toFixed()} ${dayText} в ${endDate.format(
        "dddd DD MMM"
      )} в ${endDate.format("HH:mm")}***`;
      const deadline = endDate.add(5, "d").format("dddd DD MMM HH:mm");
      const messageContent = `Приветствую ${userParsed}!\nТекущий отчетный период ***#${scoringData.currentScoringPeriod.scoringPeriodId}*** заканчивается через ${daysLeft}\nУспей подать отчет до окончания срока подачи ***${deadline}***`;
      bot.sendMessage(chatId, messageContent, options);
    }
  }
});
