import TelegramBot, { SendMessageOptions } from "node-telegram-bot-api";
import * as dotenv from "dotenv";
import axios from "axios";
import moment from "moment";

dotenv.config();

const PORT = process.env.PORT ? +process.env.PORT : 3001;
const tgApiKey = process.env.TG_API_KEY || "";
const bot = new TelegramBot(tgApiKey, { polling: true });
moment.locale("en");

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
const messageDeletionTimeout = 10000; // 10 seconds

bot.on("message", async (msg: TelegramBot.Message) => {
  if (nextSyncDate.isBefore(moment())) {
    scoringData = await loadScoringPeriodData();
    nextSyncDate = moment.parseZone(scoringData.currentScoringPeriod.ends);
  }
  if (msg && msg.from) {
    console.log(msg.chat)
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
      let dayText = "days";
      if (daysDuration === "1") {
        dayText = "day";
      }
      const daysLeft = `${duration
        .asDays()
        .toFixed()} ${dayText} on ${endDate.format("dddd DD MMM")} at ${endDate.format(
        "HH:mm"
      )}`;
      const deadline = endDate.add(5, "d").format("dddd DD MMM HH:mm");
      const messageContent = `Hello ${userParsed}!\nThe current scoring period ***#${scoringData.currentScoringPeriod.scoringPeriodId}*** ends in ***${daysLeft}***\nPlease make sure to submit your before the deadline ***${deadline}***`;
      bot.sendMessage(chatId, messageContent, options).then( (message) => 
        setTimeout(() => {
          try {
            bot.deleteMessage(chatId, msg.message_id.toString())
          } catch (e) {}
          try {
            bot.deleteMessage(chatId, message.message_id.toString())
          } catch (e) {}
        }, messageDeletionTimeout)
      )
    }
  }
});
